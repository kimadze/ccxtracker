import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
async function login(page: Page, user: string) {
  const cookies = JSON.parse(
    await readFile(".local/e2e-cookies.json", "utf8"),
  ) as Record<string, string>;
  await page.context().addCookies([
    {
      name: "better-auth.session_token",
      value: cookies[user],
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
test("real session, portfolio creation, funded acquisition and persisted journal", async ({
  page,
}, testInfo) => {
  test.setTimeout(180000);
  await login(page, `alice-${testInfo.project.name}`);
  await page.goto("/portfolios");
  await page
    .getByRole("button", { name: "პორტფელის შექმნა", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("პორტფელის სახელი").fill(`სატესტო ${Date.now()}`);
  await dialog
    .getByRole("button", { name: "პორტფელის შექმნა", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "პორტფელის მიმოხილვა" }),
  ).toBeVisible();
  const portfolioUrl = page.url();
  await page
    .getByRole("button", { name: "ტრანზაქციის დამატება", exact: true })
    .click();
  await dialog
    .getByLabel("ტრანზაქციის ტიპი", { exact: true })
    .selectOption("deposit");
  await dialog.getByLabel("აქტივი", { exact: true }).selectOption("USD");
  await dialog.getByLabel("თანხა (USD)", { exact: true }).fill("10000");
  await dialog.getByRole("button", { name: "შენახვა", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", { name: "ტრანზაქციის დამატება", exact: true })
    .click();
  await dialog
    .getByLabel("ტრანზაქციის ტიპი", { exact: true })
    .selectOption("buy");
  await dialog.getByLabel("აქტივი", { exact: true }).selectOption("bitcoin");
  await dialog.getByLabel("რაოდენობა", { exact: true }).fill("0,1");
  await dialog.getByLabel("ერთეულის ფასი (USD)", { exact: true }).fill("50000");
  await dialog.getByRole("button", { name: "შენახვა", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.goto(`${portfolioUrl}/positions/bitcoin`);
  await expect(
    page.getByRole("heading", { name: "Bitcoin", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "DCA", exact: true }).click();
  await page.getByLabel("მოსალოდნელი შესყიდვის ფასი (USD)").fill("40000");
  await expect(
    page.getByText("ახალი საშუალო ფასი", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ჟურნალი", exact: true }).click();
  await page
    .getByLabel("საინვესტიციო თეზისი", { exact: true })
    .fill("გრძელვადიანი საინვესტიციო თეზისი");
  await page.getByRole("button", { name: "ჟურნალის შენახვა" }).click();
  await expect(page.getByText("ჟურნალი შენახულია.")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "ჟურნალი", exact: true }).click();
  await expect(
    page.getByLabel("საინვესტიციო თეზისი", { exact: true }),
  ).toHaveValue("გრძელვადიანი საინვესტიციო თეზისი");
  await page.goto(`${portfolioUrl}/scenarios`);
  await page.getByLabel("BTC — სამიზნე ფასი (USD)").fill("80000");
  await page.getByLabel("სცენარის სახელი").fill("ზრდის ტესტი");
  await page.getByRole("button", { name: "შენახვა", exact: true }).click();
  await expect(page.getByText("სცენარი შენახულია.")).toBeVisible();
  await page.reload();
  await page
    .getByLabel("შენახული სცენარი")
    .selectOption({ label: "ზრდის ტესტი" });
  await expect(page.getByLabel("BTC — სამიზნე ფასი (USD)")).toHaveValue(
    /80000/,
  );
  await page.getByRole("button", { name: "ასლის შექმნა" }).click();
  await expect(page.getByLabel("სცენარის სახელი")).toHaveValue(
    "ზრდის ტესტი — ასლი",
  );
  await page.getByRole("button", { name: "წაშლა", exact: true }).click();
  await dialog.getByRole("button", { name: "წაშლა", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.goto(`${portfolioUrl}/allocation`);
  await page.getByLabel("BTC — მიზნობრივი წილი (%)").fill("70");
  await page.getByLabel("USD — მიზნობრივი წილი (%)").fill("30");
  await page.getByRole("button", { name: "განაწილების შენახვა" }).click();
  await expect(
    page.getByText("მიზნობრივი განაწილება შენახულია."),
  ).toBeVisible();
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "მენიუს გახსნა" }).click();
    await dialog.getByRole("link", { name: "დაკვირვების სია" }).click();
    await expect(dialog).not.toBeVisible();
  } else await page.goto(`${portfolioUrl}/watchlist`);
  await page.getByRole("button", { name: "აქტივის დამატება" }).click();
  await dialog.getByLabel("აქტივი", { exact: true }).selectOption("ethereum");
  await dialog.getByLabel("სასურველი შესვლის ფასი (USD)").fill("2000");
  await dialog
    .getByLabel("შენიშვნები", { exact: true })
    .fill("დაკვირვების ტესტი");
  await dialog.getByRole("button", { name: "შენახვა", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await expect(page.getByText("დაკვირვების ტესტი")).toBeVisible();
  const portfolioId = new URL(portfolioUrl).pathname.split("/").at(-1);
  const exported = await page.request.get(
    `/api/portfolios/${portfolioId}/export`,
  );
  expect(exported.ok()).toBe(true);
  const data = await exported.json();
  expect(data.transactions).toHaveLength(2);
  expect(data.scenarios).toHaveLength(1);
  expect(data.targetAllocation).toHaveLength(2);
  expect(data.watchlist).toHaveLength(1);
  await page.goto(`${portfolioUrl}/positions/bitcoin`);
  await page
    .getByRole("button", { name: "პოზიციის წაშლა", exact: true })
    .click();
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "წაშლა", exact: true }).click();
  await expect(page).toHaveURL(`${portfolioUrl}/positions`);
  await page.goto(`${portfolioUrl}/journal`);
  await expect(
    page.getByLabel("საინვესტიციო თეზისი", { exact: true }),
  ).toHaveValue("გრძელვადიანი საინვესტიციო თეზისი");
  await page.context().clearCookies();
  await login(page, "bob");
  expect(
    (await page.request.get(`/api/portfolios/${portfolioId}/export`)).status(),
  ).toBe(404);
  await page.goto(portfolioUrl);
  await expect(
    page.getByRole("heading", { name: "პორტფელის მიმოხილვა" }),
  ).not.toBeVisible();
});
