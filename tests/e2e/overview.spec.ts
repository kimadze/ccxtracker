import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { Client } from "pg";

test("compact overview supports funded positions, privacy and responsive layouts", async ({ page }, info) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const cookies = JSON.parse(await readFile(".local/e2e-cookies.json", "utf8"));
  await page.context().addCookies([{ name: "better-auth.session_token", value: cookies["alice-" + info.project.name], domain: "localhost", path: "/" }]);
  await page.goto("/portfolios");
  await page.getByRole("button", { name: "პორტფელის შექმნა", exact: true }).first().click();
  const dialog = page.locator("dialog[open]");
  await dialog.getByLabel("პორტფელის სახელი").fill("მიმოხილვის სატესტო პორტფელი");
  await dialog.getByRole("button", { name: "პორტფელის შექმნა", exact: true }).click();
  await expect(page.getByRole("heading", { name: "პორტფელის მიმოხილვა" })).toBeAttached();
  const base = page.url();
  await page.screenshot({ path: ".local/overview-empty-" + info.project.name + ".png", fullPage: true });
  for (const kind of ["შეტანა", "შესყიდვა"]) {
    await page.getByRole("button", { name: "ტრანზაქციის დამატება", exact: true }).click();
    await dialog.getByRole("button", { name: kind, exact: true }).click();
    await dialog.getByLabel("აქტივი", { exact: true }).selectOption(kind === "შეტანა" ? "USD" : "bitcoin");
    await dialog.getByLabel(kind === "შეტანა" ? "თანხა (USD)" : "რაოდენობა", { exact: true }).fill(kind === "შეტანა" ? "10000" : "0.1");
    if (kind === "შესყიდვა") await dialog.getByLabel("ერთეულის ფასი (USD)", { exact: true }).fill("50000");
    await dialog.getByRole("button", { name: "შენახვა", exact: true }).click();
    await expect(dialog).toHaveCount(0);
  }
  const db = new Client({ connectionString: "postgresql://postgres:postgres@127.0.0.1:55439/postgres" });
  await db.connect();
  try {
    await db.query("INSERT INTO market_quotes (asset_id, price, quoted_at) VALUES ('bitcoin', 3000, now()) ON CONFLICT (asset_id) DO UPDATE SET price=3000, quoted_at=now(), fetched_at=now()");
    for (let i = 0; i < 5; i++) {
      const asset = `overview-test-${i}`;
      await db.query("INSERT INTO assets (id, symbol, name, provider_id) VALUES ($1,$2,$3,$1) ON CONFLICT DO NOTHING", [asset, `TST${i}`, "განსაკუთრებით გრძელი აქტივის სატესტო დასახელება"]);
      await db.query("INSERT INTO transactions (id, portfolio_id, asset_id, kind, quantity, price, occurred_at, sequence) VALUES (gen_random_uuid(),$1,$2,'buy',10,1,now(),$3)", [new URL(base).pathname.split("/")[2], asset, i + 100]);
      await db.query("INSERT INTO market_quotes (asset_id, price, quoted_at) VALUES ($1,0.00000443,now()) ON CONFLICT (asset_id) DO UPDATE SET quoted_at=now()", [asset]);
    }
    for (let i = 1; i <= 10; i++) {
      const day = new Date(Date.now() - i * 86400000);
      await db.query("INSERT INTO portfolio_snapshots (portfolio_id, day, captured_at, value, cash, revision) VALUES ($1,$2,$3,$4,5000,0) ON CONFLICT DO NOTHING", [new URL(base).pathname.split("/")[2], day.toISOString().slice(0,10), day, String(5300 + i * 400)]);
    }
  } finally { await db.end(); }
  for (const width of [360, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await page.reload();
    await expect(page.getByRole("heading", { name: "პორტფელის მიმოხილვა" })).toBeAttached();
    if (width === 390) {
      const assets = await page.getByRole("heading", { name: "აქტივები", exact: true }).boundingBox();
      expect(assets!.y + assets!.height).toBeLessThan(760);
      await expect(page.getByRole("button", { name: "ტრანზაქციის დამატება", exact: true })).not.toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await expect(page.locator('a[href$="/positions/bitcoin"]:visible')).toBeVisible();
    await page.screenshot({ path: ".local/compact-" + info.project.name + "-" + width + ".png", fullPage: true });
  }
  await page.getByRole("button", { name: "თანხების დამალვა" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-balance-privacy", "hidden");
  await expect(page.locator(".balance-value").first()).toHaveCSS("color", "rgba(0, 0, 0, 0)");
  await page.getByRole("button", { name: "თანხების ჩვენება" }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".hover-3d > :first-child")).toHaveCSS("transform", "none");
  await page.locator('a[href$="/positions/bitcoin"]:visible').click();
  await expect(page).toHaveURL(/positions\/bitcoin$/);
  await page.goto(base);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('label[for="ccx-main-drawer"][aria-label="მენიუს გახსნა"]').click();
  await expect(page.locator("#ccx-main-drawer")).toBeChecked();
  await expect(page.getByRole("complementary", { name: "გვერდითი მენიუ" })).toBeVisible();
  await page.locator('label[for="ccx-main-drawer"][aria-label="მენიუს დახურვა"]').click();
  await expect(page.locator("#ccx-main-drawer")).not.toBeChecked();
  await page.getByText("ლიკვიდობა", { exact: true }).filter({ visible: true }).click();
  await expect(page.getByText("ნაღდი ფული", { exact: true }).filter({ visible: true })).toBeVisible();
  await page.getByRole("link", { name: "დამატება", exact: true }).click();
  await expect(page.locator("dialog[open]")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
});
