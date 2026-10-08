import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { Client } from "pg";

test("create read-only BTC and Stellar, privacy, refresh failure, edit and remove", async ({
  page,
}, info) => {
  test.skip(
    process.env.CCX_E2E_WALLET_FIXTURES !== "1",
    "Requires isolated public wallet provider fixtures",
  );
  test.setTimeout(180000);
  const user = `alice-${info.project.name}`;
  const cookies = JSON.parse(await readFile(".local/e2e-cookies.json", "utf8"));
  await page.context().addCookies([
    {
      name: "better-auth.session_token",
      value: cookies[user],
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto("/portfolios");
  await page
    .getByRole("button", { name: "პორტფელის შექმნა", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("პორტფელის ტიპი").selectOption("bitcoin");
  await dialog.getByLabel("პორტფელის სახელი").fill("Bitcoin read-only");
  await dialog.getByLabel("საჯარო მისამართები").fill("not-an-address");
  await dialog
    .getByRole("button", { name: "პორტფელის შექმნა", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("Bitcoin mainnet");
  await dialog
    .getByLabel("საჯარო მისამართები")
    .fill("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa");
  await dialog
    .getByRole("button", { name: "პორტფელის შექმნა", exact: true })
    .click();
  await expect(page).toHaveURL(/\/wallet-portfolios\/[0-9a-f-]+$/);
  await expect(
    page.getByText("$60 000,00", { exact: true }).first(),
  ).toBeVisible();
  await page.getByText("დეტალები", { exact: true }).click();
  await expect(page.getByText(/მოლოდინში ცვლილება:/)).toContainText(
    "-0,01 BTC",
  );
  await page.getByText("დეტალები", { exact: true }).click();
  const btcId = new URL(page.url()).pathname.split("/").at(-1);
  const db = new Client({
    connectionString: "postgresql://postgres:postgres@127.0.0.1:55439/postgres",
  });
  await db.connect();
  try {
    await db.query(
      "UPDATE wallet_portfolios SET last_attempt_at='2000-01-01' WHERE id=$1",
      [btcId],
    );
  } finally {
    await db.end();
  }
  await page.getByRole("button", { name: "განახლება", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "ლიმიტი" }),
  ).toBeVisible();
  await expect(
    page.getByText("$60 000,00", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("ბალანსი ვერ განახლდა. წინა მონაცემები შენარჩუნებულია."),
  ).toBeVisible();
  await page.getByRole("link", { name: "პორტფელები", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Bitcoin read-only — გახსნა" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "პორტფელის შექმნა", exact: true })
    .click();
  await dialog.getByLabel("პორტფელის ტიპი").selectOption("stellar");
  await dialog
    .getByLabel("პორტფელის სახელი")
    .fill("Stellar — ძალიან გრძელი ქართული პორტფელის სახელი");
  await dialog
    .getByLabel("საჯარო მისამართები")
    .fill("GDI73WJ4SX7LOG3XZDJC3KCK6ED6E5NBYK2JUBQSPBCNNWEG3ZN7T75U");
  await dialog
    .getByRole("button", { name: "პორტფელის შექმნა", exact: true })
    .click();
  await expect(page.getByText("არასრული ჯამი", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("list").getByText("LONGTOKEN123", { exact: true }),
  ).toBeVisible();
  await page.getByText("დეტალები", { exact: true }).click();
  await expect(page.getByText(/რეზერვი:/)).toContainText("1,5 XLM");
  await expect(page.getByText("SPAM", { exact: true })).toHaveCount(0);
  await page.getByText("დეტალები", { exact: true }).click();
  const stellarUrl = page.url();
  for (const width of [360, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.local/wallet-stellar-${width}.png`,
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "თანხების დამალვა" }).click();
  await expect(page.locator(".balance-value").first()).toHaveText("••••••");
  await page.getByRole("button", { name: "საფულის მართვა" }).click();
  await dialog.getByLabel("პორტფელის სახელი").fill("Stellar updated");
  await dialog.getByRole("button", { name: "შენახვა", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Stellar updated", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "საფულის მართვა" }).click();
  await dialog
    .getByRole("button", { name: "პორტფელის წაშლა", exact: true })
    .click();
  await dialog.getByRole("button", { name: "წაშლა", exact: true }).click();
  await expect(page).toHaveURL(/\/portfolios$/);
  await expect(
    page.getByRole("link", { name: "Stellar updated — გახსნა" }),
  ).toHaveCount(0);
  await page.context().clearCookies();
  await page.context().addCookies([
    {
      name: "better-auth.session_token",
      value: cookies.bob,
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto(stellarUrl);
  await expect(
    page.getByRole("heading", { name: "გვერდი ვერ მოიძებნა" }),
  ).toBeVisible();
  await page.goto(`/wallet-portfolios/${btcId}`);
  await expect(
    page.getByRole("heading", { name: "გვერდი ვერ მოიძებნა" }),
  ).toBeVisible();
});
