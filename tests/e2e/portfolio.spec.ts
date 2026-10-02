import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
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
  page.setDefaultTimeout(10000);
  const db = new Client({
    connectionString: "postgresql://postgres:postgres@127.0.0.1:55439/postgres",
  });
  await db.connect();
  try {
    await db.query(
      "INSERT INTO assets (id, symbol, name, provider_id) VALUES ('bitcoin', 'BTC', 'Bitcoin', 'bitcoin') ON CONFLICT DO NOTHING",
    );
    await db.query(
      "INSERT INTO market_quotes (asset_id, price, quoted_at) VALUES ('bitcoin', 3000, now()) ON CONFLICT (asset_id) DO UPDATE SET price=3000, quoted_at=now(), fetched_at=now()",
    );
  } finally {
    await db.end();
  }
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
    page.getByRole("heading", { name: /პორტფელის (მიმოხილვა|მდგომარეობა)/ }),
  ).toBeAttached();
  await expect(page).toHaveURL(/\/portfolios\/[0-9a-f-]+$/);
  const portfolioUrl = page.url();
  const transactionsUrl = `${portfolioUrl}/transactions`;
  const openTransactionForm = async () => {
    if (testInfo.project.name === "mobile") {
      await page.goto(`${transactionsUrl}?new=1`);
      await expect(dialog).toBeVisible();
    } else {
      await page
        .getByRole("button", { name: "ტრანზაქციის დამატება", exact: true })
        .click();
    }
  };
  await page.goto(transactionsUrl);
  await expect(page.locator("dialog[aria-labelledby]:not([open]) select")).toHaveCount(0);
  await openTransactionForm();
  await dialog.getByRole("button", { name: "შეტანა", exact: true }).click();
  await dialog.getByLabel("აქტივი", { exact: true }).selectOption("USD");
  await dialog.getByLabel("თანხა (USD)", { exact: true }).fill("10000");
  if (testInfo.project.name === "mobile") {
    // Short visible viewport approximates keyboard-reduced space; physical-device
    // keyboard validation remains a separate acceptance check.
    await page.setViewportSize({ width: 390, height: 420 });
    await dialog.getByLabel("თანხა (USD)", { exact: true }).focus();
    const save = dialog.getByRole("button", { name: "შენახვა", exact: true });
    await save.scrollIntoViewIfNeeded();
    expect((await save.boundingBox())!.y + (await save.boundingBox())!.height).toBeLessThanOrEqual(421);
    await save.focus();
    const amount = dialog.getByLabel("თანხა (USD)", { exact: true });
    await amount.focus();
    const amountBounds = (await amount.boundingBox())!;
    const actionBounds = (await dialog.locator(".modal-action").boundingBox())!;
    expect(amountBounds.y + amountBounds.height).toBeLessThanOrEqual(actionBounds.y);
    expect(await dialog.locator(".modal-box").evaluate((box) => box.scrollWidth <= box.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: ".local/mobile-form-short-viewport.png" });
    await page.setViewportSize({ width: 390, height: 844 });
  }
  await dialog.getByRole("button", { name: "შენახვა", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await openTransactionForm();
  await dialog.getByRole("button", { name: "შესყიდვა", exact: true }).click();
  await dialog.getByLabel("აქტივი", { exact: true }).selectOption("bitcoin");
  await dialog.getByLabel("რაოდენობა", { exact: true }).fill("0,1");
  await dialog.getByLabel("ერთეულის ფასი (USD)", { exact: true }).fill("50000");
  await dialog.getByRole("button", { name: "შენახვა", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const acquisition = await page.request.get(
    `/api/portfolios/${new URL(portfolioUrl).pathname.split("/").at(-1)}/export`,
  );
  expect(acquisition.ok()).toBe(true);
  expect((await acquisition.json()).transactions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        assetId: "bitcoin",
        kind: "buy",
        quantity: expect.stringMatching(/^0\.10*$/),
      }),
    ]),
  );
  await openTransactionForm();
  await dialog.getByLabel("რაოდენობა", { exact: true }).fill("0.2");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await openTransactionForm();
  await expect(dialog.getByLabel("რაოდენობა", { exact: true })).toHaveValue(
    testInfo.project.name === "mobile" ? "" : "0.2",
  );
  await dialog.getByRole("button", { name: "გაუქმება", exact: true }).click();
  await page.goto(portfolioUrl);
  await page.getByRole("button", { name: "თანხების დამალვა" }).click();
  await expect(page.locator(".balance-value").first()).toContainText("••••••");
  await page.getByRole("button", { name: "თანხების ჩვენება" }).click();
  await expect(page.locator(".balance-value").first()).not.toContainText("••••••");
  await page.goto(`${portfolioUrl}/settings`);
  await page
    .getByRole("checkbox", { name: /მხოლოდ კრიპტოაქტივების ღირებულება/ })
    .check();
  await page.getByRole("button", { name: "პროფილის შენახვა" }).click();
  await expect(page.getByText("პროფილი განახლებულია.")).toBeVisible();
  await page.goto(portfolioUrl);
  await expect(
    page.getByRole("heading", {
      name: "კრიპტოაქტივების ღირებულება",
    }),
  ).toBeVisible();
  await page.goto(`${portfolioUrl}/positions/bitcoin`);
  await expect(
    page.getByRole("heading", { name: "Bitcoin", exact: true }),
  ).toBeVisible();
  await page.goto(`${portfolioUrl}/positions/bitcoin?tab=dca`);
  await page.getByLabel("მოსალოდნელი შესყიდვის ფასი (USD)").fill("40000");
  await expect(
    page.getByText("ახალი საშუალო ფასი", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "ჟურნალი", exact: true }).click();
  await page
    .getByLabel("საინვესტიციო თეზისი", { exact: true })
    .fill("გრძელვადიანი საინვესტიციო თეზისი");
  await page.getByRole("button", { name: "ჟურნალის შენახვა" }).click();
  await expect(page.getByText("ჟურნალი შენახულია.")).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "ჟურნალი", exact: true }).click();
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
  await page.getByLabel("BTC სამიზნე წილი").fill("100");
  await page
    .getByRole("button", {
      name: "შენახვა",
      exact: true,
    })
    .click();
  await expect(page.getByText("განაწილება შენახულია.")).toBeVisible();
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "მეტი გვერდი" }).click();
    await expect(
      page
        .getByRole("dialog", { name: "ყველა ხელსაწყო" })
        .getByRole("link", { name: "ტრანზაქციები", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("dialog", { name: "ყველა ხელსაწყო" })
      .getByRole("link", { name: "დაკვირვების სია" })
      .click();
    await expect(dialog).not.toBeVisible();
  } else await page.goto(`${portfolioUrl}/watchlist`);
  await page
    .getByRole("button", { name: "აქტივის დამატება", exact: true })
    .click();
  await dialog.getByLabel("აქტივი", { exact: true }).selectOption("ethereum");
  await dialog.getByLabel("სასურველი შესვლის ფასი (USD)").fill("2000");
  await dialog
    .getByLabel("შენიშვნები", { exact: true })
    .fill("დაკვირვების ტესტი");
  await dialog.getByRole("button", { name: "შენახვა", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await expect(page.getByText("ETH", { exact: true }).first()).toBeVisible();
  const portfolioId = new URL(portfolioUrl).pathname.split("/").at(-1);
  const exported = await page.request.get(
    `/api/portfolios/${portfolioId}/export`,
  );
  expect(exported.ok()).toBe(true);
  const data = await exported.json();
  expect(data.transactions).toHaveLength(2);
  expect(data.scenarios).toHaveLength(1);
  expect(data.targetAllocation).toHaveLength(1);
  expect(data.watchlist).toHaveLength(1);
  await page.goto(`${portfolioUrl}/positions/bitcoin`);
  await page.getByLabel("მეტი მოქმედება").click();
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
    page.getByRole("heading", { name: /პორტფელის (მიმოხილვა|მდგომარეობა)/ }),
  ).not.toBeVisible();
});
