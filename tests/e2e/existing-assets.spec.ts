import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { Client } from "pg";

test("existing holdings need no USD funding and compact forms retain visible actions", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const cookies = JSON.parse(await readFile(".local/e2e-cookies.json", "utf8"));
  await page
    .context()
    .addCookies([
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
  try {
    await db.query(
      "INSERT INTO assets (id, symbol, name, provider_id) VALUES ('bitcoin','BTC','Bitcoin','bitcoin') ON CONFLICT DO NOTHING",
    );
    await page.goto("/portfolios");
    await page
      .getByRole("button", { name: "პორტფელის შექმნა", exact: true })
      .first()
      .click();
    const create = page.locator("dialog[open]");
    await create
      .getByLabel("პორტფელის სახელი")
      .fill(`არსებული აქტივები ${info.project.name}`);
    await create
      .getByRole("button", { name: "პორტფელის შექმნა", exact: true })
      .click();
    await expect(page).toHaveURL(/\/portfolios\/[0-9a-f-]+$/);
    const base = page.url();
    const portfolioId = base.split("/").pop();
    await page.goto(`${base}/transactions?new=1`);
    const form = page.getByRole("dialog", {
      name: "ტრანზაქციის დამატება",
      exact: true,
    });
    await expect(form).toBeVisible();
    const type = form.getByLabel("ტრანზაქციის ტიპი");
    for (const width of [360, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      for (const kind of [
        "buy",
        "sell",
        "asset-deposit",
        "cash-deposit",
        "withdrawal",
        "fee",
        "airdrop",
      ]) {
        await type.selectOption(kind);
        const save = form.getByRole("button", { name: "შენახვა", exact: true });
        await expect(save).toBeInViewport();
        expect((await save.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
      }
      await type.selectOption("asset-deposit");
      await page.screenshot({
        path: `.local/existing-assets-${width}-${info.project.name}.png`,
      });
    }
    await page.setViewportSize({ width: 390, height: 420 });
    await form.getByLabel("რაოდენობა", { exact: true }).fill("2");
    await expect(
      form.getByRole("button", { name: "შენახვა", exact: true }),
    ).toBeInViewport();
    await page.screenshot({
      path: `.local/existing-assets-keyboard-${info.project.name}.png`,
    });
    await form.getByRole("button", { name: "შენახვა", exact: true }).click();
    await expect(form).not.toBeVisible();
    const rows = await db.query(
      "SELECT kind, asset_id, quantity, price, fee FROM transactions WHERE portfolio_id=$1",
      [portfolioId],
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]).toMatchObject({
      kind: "deposit",
      asset_id: "bitcoin",
      price: null,
    });
    expect(Number(rows.rows[0].quantity)).toBe(2);
    expect(Number(rows.rows[0].fee)).toBe(0);
    // Add another opening holding with known basis, still without a USD deposit.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${base}/transactions?new=1`);
    await type.selectOption("asset-deposit");
    await form.getByLabel("რაოდენობა", { exact: true }).fill("1");
    await form.getByLabel("საშუალო თვითღირებულება (USD)").fill("100");
    await form.getByRole("button", { name: "შენახვა", exact: true }).click();
    await expect(form).not.toBeVisible();
    const known = await db.query(
      "SELECT kind, asset_id, price FROM transactions WHERE portfolio_id=$1 ORDER BY sequence",
      [portfolioId],
    );
    expect(known.rows).toHaveLength(2);
    expect(
      known.rows.every((r) => r.kind === "deposit" && r.asset_id === "bitcoin"),
    ).toBe(true);
    expect(Number(known.rows[1].price)).toBe(100);
  } finally {
    await db.end();
  }
});
