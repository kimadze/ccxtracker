import { expect, test } from "@playwright/test";
test("public entry and honest demo render without horizontal overflow", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("ინვესტიციები");
  await page.getByRole("link", { name: "დიზაინის ნახვა" }).click();
  await expect(page.getByRole("heading", { name: "პორტფელის მიმოხილვა" })).toBeVisible();
  await expect(page.getByText("სადემონსტრაციო რეჟიმი", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: `test-results/overview-${testInfo.project.name}.png`, fullPage: true });
});
test("anonymous portfolio routes require sign-in", async ({ page }) => {
  await page.goto("/portfolios/00000000-0000-4000-8000-000000000001/transactions");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("button", { name: "Google-ით შესვლა" })).toBeVisible();
});
