import { expect, test } from "@playwright/test";
test("public entry and honest demo render without horizontal overflow", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "ინვესტიციები",
  );
  await page.getByRole("link", { name: "დიზაინის ნახვა" }).click();
  await expect(
    page.getByRole("heading", { name: "პორტფელის მიმოხილვა" }),
  ).toBeVisible();
  await expect(
    page.getByText("სადემონსტრაციო რეჟიმი", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/overview-${testInfo.project.name}.png`,
    fullPage: true,
  });
});
test("anonymous portfolio routes require sign-in", async ({ page }) => {
  await page.goto(
    "/portfolios/00000000-0000-4000-8000-000000000001/transactions",
  );
  await expect(page).toHaveURL(/\/login/);
  await expect(
    page.getByRole("button", { name: "Google-ით შესვლა" }),
  ).toBeVisible();
});
test("statistics preview hydrates without client/server text mismatches", async ({
  page,
}) => {
  const hydrationErrors: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      message.text().toLowerCase().includes("hydration")
    )
      hydrationErrors.push(message.text());
  });
  await page.goto("/preview/statistics");
  await expect(page.getByText("$3,84 ტრილ.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "მაკრო", exact: true }).click();
  await expect(page.getByRole("heading", { name: "მაკრო გარემო" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "ეკონომიკური კალენდარი" })).toBeVisible();
  await page.getByLabel("მოვლენის კატეგორია").selectOption("fed");
  await expect(page.getByRole("heading", { name: "FED — განაკვეთის გადაწყვეტილება", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "PPI · MoM", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.waitForTimeout(250);
  expect(hydrationErrors).toEqual([]);
});
test("every preview workspace fits phone, tablet and desktop widths", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const widths = info.project.name === "mobile" ? [390, 768] : [1440];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    for (const section of [
      "positions",
      "transactions",
      "analytics",
      "statistics",
      "strategy",
      "journal",
      "scenarios",
      "allocation",
      "watchlist",
      "settings",
    ]) {
      const response = await page.goto(`/preview/${section}`);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      if (section === "analytics") {
        await expect(
          page.getByRole("heading", { name: "პორტფელის შედეგის წყარო" }),
        ).toBeVisible();
        await expect(page.getByText("Bitcoin", { exact: true })).toBeVisible();
        await page.screenshot({
          path: `test-results/attribution-${info.project.name}.png`,
          fullPage: true,
        });
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `${section} at ${width}px`,
      ).toBe(true);
    }
  }
});
