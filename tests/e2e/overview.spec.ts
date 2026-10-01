import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { Client } from "pg";

test("compact overview supports funded positions, privacy and responsive layouts", async ({ page }, info) => {
  test.setTimeout(180000);
  const cookies = JSON.parse(await readFile(".local/e2e-cookies.json", "utf8"));
  await page.context().addCookies([{ name: "better-auth.session_token", value: cookies["alice-" + info.project.name], domain: "localhost", path: "/" }]);
  await page.goto("/portfolios");
  await page.getByRole("button", { name: "პორტფელის შექმნა", exact: true }).first().click();
  const dialog = page.locator("dialog[open]");
  await dialog.getByLabel("პორტფელის სახელი").fill("მიმოხილვის სატესტო პორტფელი");
  await dialog.getByRole("button", { name: "პორტფელის შექმნა", exact: true }).click();
  await expect(page.getByRole("heading", { name: "პორტფელის მიმოხილვა" })).toBeVisible();
  const base = page.url();
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
    for (let i = 1; i <= 10; i++) {
      const day = new Date(Date.now() - i * 86400000);
      await db.query("INSERT INTO portfolio_snapshots (portfolio_id, day, captured_at, value, cash, revision) VALUES ($1,$2,$3,$4,5000,0) ON CONFLICT DO NOTHING", [new URL(base).pathname.split("/")[2], day.toISOString().slice(0,10), day, String(5300 + i * 400)]);
    }
  } finally { await db.end(); }
  for (const width of [360, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.reload();
    await expect(page.getByRole("heading", { name: "პორტფელის მიმოხილვა" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: ".local/compact-" + info.project.name + "-" + width + ".png", fullPage: true });
  }
  await page.getByRole("button", { name: "თანხების დამალვა" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-balance-privacy", "hidden");
  await expect(page.locator(".balance-value").first()).toHaveCSS("color", "rgba(0, 0, 0, 0)");
  await page.getByRole("button", { name: "თანხების ჩვენება" }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".hover-3d > :first-child")).toHaveCSS("transform", "none");
  await page.locator('a[href$="/positions/bitcoin"]').click();
  await expect(page).toHaveURL(/positions\/bitcoin$/);
  await page.goto(base);
});
