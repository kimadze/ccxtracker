import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("risk calculator uses the existing shell and validates both directions", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const cookies = JSON.parse(await readFile(".local/e2e-cookies.json", "utf8"));
  await page.context().addCookies([
    {
      name: "better-auth.session_token",
      value: cookies["alice-" + info.project.name],
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto("/portfolios");
  await page
    .getByRole("button", { name: "პორტფელის შექმნა", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("პორტფელის სახელი").fill("Risk calculator test");
  await dialog
    .getByRole("button", { name: "პორტფელის შექმნა", exact: true })
    .click();
  await expect(page).toHaveURL(/\/portfolios\/[0-9a-f-]+$/, { timeout: 30000 });
  const base = page.url();
  await page.goto(base + "/tools/risk-calculator");
  await page.getByLabel("რისკი თითო გარიგებაზე (%)").fill("0.5");
  await page.getByText("Take Profit · დამატებით", { exact: true }).click();
  await page.getByLabel("Take Profit (USD)").fill("102500");
  const output = page.getByRole("region", { name: "გამოთვლის შედეგი" });
  await expect(output.getByText("$50,00", { exact: true })).toHaveCount(2);
  await expect(output.getByText("$5 000,00", { exact: true })).toBeVisible();
  await expect(output.getByText("0,05", { exact: true })).toBeVisible();
  await expect(output.getByText("$1 000,00", { exact: true })).toBeVisible();
  await expect(output.getByText("$125,00", { exact: true })).toBeVisible();
  await expect(output.getByText("1:2.5", { exact: true })).toBeVisible();
  for (const width of [360, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    for (const control of await page.locator("main input, main button").all()) {
      const box = await control.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({
      path: `.local/risk-calculator-${width}.png`,
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "SHORT", exact: true }).click();
  await expect(page.getByLabel("Stop Loss (USD)")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(output.getByText("1:2.5", { exact: true })).toHaveCount(0);
  await page.getByLabel("Stop Loss (USD)").fill("101000");
  await page.getByLabel("Take Profit (USD)").fill("97500");
  await expect(output.getByText("1:2.5", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "1%", exact: true }).click();
  await expect(output.getByText("$100,00", { exact: true })).toHaveCount(2);
  await page.getByLabel("ლევერიჯი (x)").fill("0");
  await expect(page.getByLabel("ლევერიჯი (x)")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.getByLabel("ლევერიჯი (x)").fill("5");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "მეტი გვერდი" }).click();
  await expect(
    page.getByRole("dialog").getByRole("link", { name: "რისკის კალკულატორი" }),
  ).toBeVisible();
});
