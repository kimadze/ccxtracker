import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import type { Page } from "@playwright/test";

async function portfolioFixture(page: Page, project: string) {
  const cookies = JSON.parse(await readFile(".local/e2e-cookies.json", "utf8"));
  await page.context().addCookies([
    {
      name: "better-auth.session_token",
      value: cookies[`alice-${project}`],
      domain: "localhost",
      path: "/",
    },
  ]);
  const db = new Client({
    connectionString: "postgresql://postgres:postgres@127.0.0.1:55439/postgres",
  });
  await db.connect();
  const id = randomUUID();
  try {
    await db.query(
      "INSERT INTO portfolios(id,user_id,name) VALUES($1,$2,'PWA სატესტო პორტფელი')",
      [id, `alice-${project}`],
    );
    await db.query(
      "INSERT INTO assets(id,symbol,name,provider_id) VALUES('bitcoin','BTC','Bitcoin','bitcoin') ON CONFLICT DO NOTHING",
    );
    await db.query(
      "INSERT INTO transactions(id,portfolio_id,asset_id,kind,quantity,price,occurred_at,sequence) VALUES(gen_random_uuid(),$1,'bitcoin','deposit',1,1,now(),1)",
      [id],
    );
    await db.query(
      "INSERT INTO market_quotes(asset_id,price,change_24h,quoted_at) VALUES('bitcoin',10,1,now()) ON CONFLICT(asset_id) DO UPDATE SET price=10,change_24h=1,quoted_at=now(),fetched_at=now()",
    );
  } finally {
    await db.end();
  }
  return `/portfolios/${id}`;
}

test("PWA icons are available at declared sizes with Apple support and maskable safe area", async ({
  page,
  request,
}) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({
    start_url: "/portfolios",
    scope: "/",
    display: "standalone",
    theme_color: "#0e0f12",
  });
  expect(
    manifest.icons.filter((i: { purpose: string }) => i.purpose === "any"),
  ).toHaveLength(3);
  expect(
    manifest.icons.filter((i: { purpose: string }) => i.purpose === "maskable"),
  ).toHaveLength(2);
  for (const icon of manifest.icons) {
    const image = await request.get(icon.src);
    expect(image.ok()).toBe(true);
    const bytes = await image.body(),
      metadata = await sharp(bytes).metadata();
    expect(`${metadata.width}x${metadata.height}`).toBe(icon.sizes);
    if (icon.purpose === "maskable") {
      const { data, info } = await sharp(bytes)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const center = (info.width - 1) / 2,
        safe = info.width * 0.4;
      let maximumRadius = 0;
      for (let y = 0; y < info.height; y++)
        for (let x = 0; x < info.width; x++) {
          const p = (y * info.width + x) * 4;
          if (
            Math.max(
              Math.abs(data[p] - 12),
              Math.abs(data[p + 1] - 13),
              Math.abs(data[p + 2] - 18),
            ) > 20
          )
            maximumRadius = Math.max(
              maximumRadius,
              Math.hypot(x - center, y - center),
            );
        }
      expect(maximumRadius).toBeLessThanOrEqual(safe);
    }
  }
  await page.goto("/login");
  await expect(
    page.locator('meta[name="mobile-web-app-capable"]'),
  ).toHaveAttribute("content", "yes");
  await expect(
    page.locator('meta[name="apple-mobile-web-app-status-bar-style"]'),
  ).toHaveAttribute("content", "black-translucent");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    manifest.theme_color,
  );
  const apple = page.locator('link[rel="apple-touch-icon"]');
  await expect(apple).toHaveAttribute("href", "/icons/ccx-apple-180-v3.png");
  expect(
    (
      await sharp(
        await (await request.get("/icons/ccx-apple-180-v3.png")).body(),
      ).metadata()
    ).width,
  ).toBe(180);
  const favicon = await request.get("/icon.svg");
  expect(favicon.ok()).toBe(true);
  expect(await favicon.text()).not.toContain("<image");
});

test("offline navigation shows a safe fallback without caching private pages", async ({
  page,
}, info) => {
  test.setTimeout(60000);
  const base = await portfolioFixture(page, info.project.name);
  await page.goto(base);
  await expect(
    page.getByRole("heading", { name: "პორტფელის მიმოხილვა" }),
  ).toBeAttached();
  await page.waitForFunction(
    () => Boolean(navigator.serviceWorker?.controller),
    undefined,
    { timeout: 15000 },
  );
  const cachedPaths = await page.evaluate(async () => {
    const keys = await caches.keys();
    const requests = await Promise.all(
      keys.map(async (key) => (await caches.open(key)).keys()),
    );
    return requests.flat().map((request) => new URL(request.url).pathname);
  });
  expect(cachedPaths.length).toBeGreaterThan(0);
  expect(
    cachedPaths.every(
      (path) =>
        !path.startsWith("/portfolios") &&
        !path.startsWith("/api/") &&
        !path.startsWith("/_next/"),
    ),
  ).toBe(true);
  if (info.project.name === "mobile")
    await page
      .getByRole("region", { name: "USD ნაშთი და სტეიბლკოინები", exact: true })
      .locator("summary")
      .click();
  await page.screenshot({
    path: `.local/pwa-online-${info.project.name}.png`,
    fullPage: true,
  });
  await page.context().setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "კავშირი არ არის" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      /მონაცემები ამ მოწყობილობაზე offline რეჟიმისთვის არ ინახება/,
    ),
  ).toBeVisible();
  await page.context().setOffline(false);
  await page.getByRole("button", { name: "ხელახლა ცდა", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "პორტფელის მიმოხილვა" }),
  ).toBeAttached();
});

test("PWA update preserves a declined draft and catches synchronous controller replacement", async ({
  page,
}, info) => {
  test.setTimeout(60000);
  const base = await portfolioFixture(page, info.project.name);
  await page.addInitScript(() => {
    const serviceWorker = new EventTarget();
    const waiting = sessionStorage.getItem("pwa-test-posts")
      ? null
      : {
          postMessage() {
            sessionStorage.setItem("pwa-test-posts", "1");
            serviceWorker.dispatchEvent(new Event("controllerchange"));
          },
        };
    const registration = Object.assign(new EventTarget(), {
      waiting,
      installing: null,
      update: async () => undefined,
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: Object.assign(serviceWorker, {
        controller: {},
        register: async () => registration,
      }),
    });
  });
  await page.goto(base + "/journal");
  const thesis = page.getByLabel("საინვესტიციო თეზისი", { exact: true });
  const update = page.getByRole("button", { name: "განახლება", exact: true });
  await expect(update).toBeVisible();
  await thesis.fill("შეუნახავი PWA თეზისი");
  await page.screenshot({ path: `.local/pwa-update-${info.project.name}.png` });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  let declined = false;
  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    declined = true;
    await dialog.dismiss();
  });
  await update.click();
  expect(declined).toBe(true);
  await expect(thesis).toHaveValue("შეუნახავი PWA თეზისი");
  expect(
    await page.evaluate(() => sessionStorage.getItem("pwa-test-posts")),
  ).toBeNull();
  page.once("dialog", (dialog) => dialog.accept());
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded" }),
    update.click(),
  ]);
  await expect(update).toHaveCount(0);
  expect(
    await page.evaluate(() => sessionStorage.getItem("pwa-test-posts")),
  ).toBe("1");
  await expect(thesis).toHaveValue("");
});
