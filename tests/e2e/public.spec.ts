import { expect, test } from "@playwright/test";

test("public entry directs visitors to the live portfolio workflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("ინვესტიციები");
  await expect(page.getByRole("link", { name: "პორტფელის შექმნა" })).toHaveAttribute("href", "/login");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("anonymous portfolio routes require sign-in", async ({ page }) => {
  await page.goto("/portfolios/00000000-0000-4000-8000-000000000001/transactions");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("button", { name: "Google-ით შესვლა" })).toBeVisible();
});
