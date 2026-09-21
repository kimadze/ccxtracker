import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { Client } from "pg";

async function signIn(page: Page, user: string) {
  const cookies = JSON.parse(await readFile(".local/e2e-cookies.json", "utf8")) as Record<string, string>;
  await page.context().addCookies([{
    name: "better-auth.session_token",
    value: cookies[user],
    domain: "localhost",
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  }]);
}

test("redesigned workspace keeps its routes usable without page overflow", async ({ page }, testInfo) => {
  test.setTimeout(300000);
  const hydrationErrors: string[] = [];
  page.on("console", (message) => {
    if (/hydration|didn't match the client/i.test(message.text())) hydrationErrors.push(message.text());
  });
  await signIn(page, "alice-" + testInfo.project.name);
  await page.goto("/portfolios");
  await page.getByRole("button", { name: "პორტფელის შექმნა", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("პორტფელის სახელი").fill("დიზაინის შემოწმება");
  await dialog.getByRole("button", { name: "პორტფელის შექმნა", exact: true }).click();
  await expect(page.getByRole("heading", { name: "პორტფელის მიმოხილვა" })).toBeVisible();
  const base = new URL(page.url()).pathname;
  const db = new Client({ connectionString: "postgresql://postgres:postgres@127.0.0.1:55439/postgres" });
  await db.connect();
  try {
    const current = new Date();
    for (let index = 44; index >= 0; index--) {
      const capturedAt = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate() - index, 12));
      await db.query(
        "INSERT INTO portfolio_snapshots (portfolio_id, day, captured_at, value, cash, revision) VALUES ($1, $2, $3, $4, $5, 0)",
        [base.split("/")[2], capturedAt.toISOString().slice(0, 10), capturedAt, String(10000 + index * 12), "10000"],
      );
    }
  } finally {
    await db.end();
  }
  await page.reload();
  await page.getByRole("button", { name: "ALL", exact: true }).click();
  await page.getByText("მონაცემების ცხრილი").click();
  await expect(page.locator("details tbody tr")).toHaveCount(45);
  const paths = [
    "", "/positions", "/transactions", "/airdrops", "/analytics", "/statistics",
    "/watchlist", "/allocation", "/strategy", "/scenarios", "/journal", "/settings",
  ];
  await page.setViewportSize({ width: testInfo.project.name === "desktop" ? 1536 : 390, height: 900 });
  for (const path of paths) {
    await page.goto(base + path);
    await expect(page.locator("main.ccx-main")).toBeVisible();
    await expect(page.locator("main.ccx-main h1").first()).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), path).toBe(true);
    if (testInfo.project.name === "desktop" && ["/analytics", "/statistics", "/allocation", "/scenarios"].includes(path)) {
      await page.screenshot({ path: ".local/rebrand-page-" + path.slice(1) + ".png", fullPage: true });
    }
  }
  await page.goto(base);
  await expect(page.getByText("ლიკვიდობა", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "გვერდების ძიება" })).toBeVisible();
  await page.getByRole("button", { name: "გვერდების ძიება" }).click();
  await expect(page.getByRole("dialog", { name: "გვერდების ძიება" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "გვერდების ძიება" })).not.toBeVisible();
  expect(hydrationErrors).toEqual([]);
  for (const width of [1536, 1024, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.reload();
    await expect(page.getByRole("heading", { name: "პორტფელის მიმოხილვა" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), String(width)).toBe(true);
    if (width === 1536 || width === 390) {
      await page.screenshot({ path: ".local/rebrand-" + testInfo.project.name + "-" + width + ".png", fullPage: true });
    }
    if (width === 390) {
      await page.getByRole("button", { name: "მენიუს გახსნა" }).click();
      const menu = page.getByRole("dialog", { name: "მთავარი მენიუ" });
      await expect(menu).toBeVisible();
      await menu.getByRole("link", { name: "პოზიციები" }).click();
      await expect(page).toHaveURL(/\/positions$/);
      await page.goto(base);
      await expect(page.getByRole("heading", { name: "პორტფელის მიმოხილვა" })).toBeVisible();
    }
  }
  await page.setViewportSize({ width: 320, height: 800 });
  for (const path of paths) {
    await page.goto(base + path);
    await expect(page.locator("main.ccx-main h1").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), path + " at 320px").toBe(true);
  }
});
