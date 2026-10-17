import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { chooseAsset } from "./asset-picker-helper";

test("asset selection stays short, explicit and usable at all widths; history periods stay aligned", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const cookies = JSON.parse(await readFile(".local/e2e-cookies.json", "utf8"));
  await page.context().addCookies([
    {
      name: "better-auth.session_token",
      value: cookies[`alice-${info.project.name}`],
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
      "INSERT INTO portfolios(id,user_id,name) VALUES($1,$2,'მონეტების არჩევა')",
      [id, `alice-${info.project.name}`],
    );
    for (const [asset, symbol] of [
      ["bitcoin", "BTC"],
      ["ethereum", "ETH"],
      ["stellar", "XLM"],
      ["stellar-copy", "XLM"],
    ]) {
      await db.query(
        "INSERT INTO assets(id,symbol,name,provider_id) VALUES($1,$2,$1,$1) ON CONFLICT DO NOTHING",
        [asset, symbol],
      );
    }
    for (let i = 0; i < 165; i++) {
      await db.query(
        "INSERT INTO assets(id,symbol,name,provider_id) VALUES($1,$2,$3,$1) ON CONFLICT DO NOTHING",
        [
          `catalogue-${i}`,
          `C${i}`,
          `ძალიან გრძელი ქართული მონეტის დასახელება ${i}`,
        ],
      );
    }
    await db.query(
      "INSERT INTO transactions(id,portfolio_id,asset_id,kind,quantity,price,occurred_at,sequence) VALUES(gen_random_uuid(),$1,'stellar','deposit',100,1,now(),1)",
      [id],
    );
    await db.query(
      "INSERT INTO market_quotes(asset_id,price,quoted_at) VALUES('stellar',1,now()) ON CONFLICT(asset_id) DO UPDATE SET price=1,quoted_at=now(),fetched_at=now() ",
    );
    for (let i = 1; i <= 7; i++) {
      const date = new Date(Date.now() - i * 86400000);
      await db.query(
        "INSERT INTO portfolio_snapshots(portfolio_id,day,captured_at,value,cash,revision) VALUES($1,$2,$3,$4,0,0)",
        [id, date.toISOString().slice(0, 10), date, String(100 + i)],
      );
    }
  } finally {
    await db.end();
  }
  const base = `/portfolios/${id}`;
  await page.goto(`${base}/transactions?new=1`);
  const form = page.getByRole("dialog", {
    name: "ტრანზაქციის დამატება",
    exact: true,
  });
  const trigger = form.getByRole("button", { name: "აქტივი", exact: true });
  await trigger.click();
  const chooser = form.getByRole("region", {
    name: "აქტივი — არჩევა",
    exact: true,
  });
  const search = chooser.getByRole("textbox", {
    name: "აქტივი — ძიება",
    exact: true,
  });
  await expect(chooser.locator("[data-asset-result]")).toHaveCount(6);
  await expect(chooser.locator("[data-asset-result]").first()).toHaveAttribute(
    "data-asset-result",
    "stellar",
  );
  await search.fill("XLM");
  await expect(chooser.locator("[data-asset-result]")).toHaveCount(2);
  await expect(trigger).toContainText("BTC");
  await search.press("Escape");
  await expect(chooser).not.toBeVisible();
  await expect(form).toBeVisible();
  await expect(trigger).toBeFocused();
  await chooseAsset(form, "stellar-copy");
  await expect(trigger).toContainText("stellar-copy");
  await trigger.click();
  await search.fill("not-a-real-coin");
  await expect(chooser.getByRole("status")).toHaveText("აქტივი ვერ მოიძებნა.");
  await expect(trigger).toContainText("stellar-copy");
  await search.fill("catalogue-1");
  for (const width of [360, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await search.scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await expect(
      form.getByRole("button", { name: "შენახვა", exact: true }),
    ).toBeInViewport();
    await page.screenshot({
      path: `.local/asset-picker-${width}-${info.project.name}.png`,
    });
  }
  await search.fill("stellar");
  await search.press("ArrowDown");
  await expect(chooser.locator('[data-asset-result="stellar"]')).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(chooser).not.toBeVisible();
  await expect(trigger).toContainText("XLM");
  await form.getByRole("button", { name: "გაუქმება", exact: true }).click();
  await page.goto(`${base}/positions`);
  await page
    .getByRole("button", { name: "პოზიციის დამატება", exact: true })
    .click();
  // The same picker is used by both transaction and existing-position forms.
  const activeDialog = page.locator("dialog[open]");
  await expect(
    activeDialog.getByRole("button", { name: "აქტივი", exact: true }),
  ).toBeVisible();
  await chooseAsset(activeDialog, "stellar");
  await activeDialog
    .getByRole("button", { name: "გაუქმება", exact: true })
    .click();
  await page.goto(base);
  const periods = page.getByRole("group", {
    name: "გრაფიკის პერიოდი",
    exact: true,
  });
  for (const width of [360, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(periods.getByRole("button")).toHaveCount(6);
    const boxes = await periods.getByRole("button").evaluateAll((elements) =>
      elements.map((e) => {
        const r = e.getBoundingClientRect();
        return { width: r.width, height: r.height, top: r.top };
      }),
    );
    expect(
      Math.max(...boxes.map((b) => b.width)) -
        Math.min(...boxes.map((b) => b.width)),
    ).toBeLessThan(2);
    expect(
      boxes.every(
        (b) =>
          b.height >= (width < 1024 ? 44 : 32) &&
          Math.abs(b.top - boxes[0].top) < 1,
      ),
    ).toBe(true);
    expect((await periods.boundingBox())!.width).toBeLessThanOrEqual(
      width < 1024 ? 264 : 216,
    );
    await periods.getByRole("button", { name: "7D", exact: true }).click();
    await expect(
      periods.getByRole("button", { name: "7D", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.screenshot({
      path: `.local/history-periods-${width}-${info.project.name}.png`,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  }
});
