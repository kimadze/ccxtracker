import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

test("deleting USD updates total value, liquidity and portfolio cards without a manual refresh", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const cookies = JSON.parse(await readFile(".local/e2e-cookies.json", "utf8"));
  const user = `alice-${info.project.name}`;
  await page.context().addCookies([
    {
      name: "better-auth.session_token",
      value: cookies[user],
      domain: "localhost",
      path: "/",
    },
  ]);
  const db = new Client({
    connectionString: "postgresql://postgres:postgres@127.0.0.1:55439/postgres",
  });
  const id = randomUUID(),
    deposit = randomUUID();
  const name = `USD წაშლის შემოწმება ${info.project.name}`;
  await db.connect();
  try {
    await db.query(
      "INSERT INTO portfolios (id,user_id,name) VALUES ($1,$2,$3)",
      [id, user, name],
    );
    await db.query(
      "INSERT INTO assets (id,symbol,name,provider_id) VALUES ('cash-test','TEST','სატესტო აქტივი','cash-test'),('USD','USD','Cash','USD') ON CONFLICT DO NOTHING",
    );
    await db.query(
      "INSERT INTO market_quotes (asset_id,price,quoted_at) VALUES ('cash-test',150,now()) ON CONFLICT (asset_id) DO UPDATE SET price=150,quoted_at=now(),fetched_at=now()",
    );
    await db.query(
      "INSERT INTO transactions (id,portfolio_id,asset_id,kind,quantity,price,occurred_at,sequence) VALUES ($1,$2,'USD','deposit',1000,NULL,now(),1),($3,$2,'cash-test','deposit',2,100,now(),2)",
      [deposit, id, randomUUID()],
    );
    const base = `/portfolios/${id}`;
    await page.goto(base);
    const summary = page.getByRole("region", { name: "ღირებულება და ისტორია" });
    await expect(summary).toContainText("$1 300,00");
    await expect(summary).toContainText("$100,00");
    if (info.project.name === "mobile")
      await page.getByRole("button", { name: "მეტი გვერდი" }).click();
    await page.getByRole("link", { name: "ტრანზაქციები", exact: true }).click();
    const row =
      info.project.name === "desktop"
        ? page.locator("tbody tr").filter({ hasText: "USD" })
        : page
            .locator("li")
            .filter({ has: page.locator("details") })
            .filter({ hasText: "USD" });
    if (info.project.name === "mobile") await row.locator("summary").click();
    await row.getByRole("button", { name: /წაშლა/ }).click();
    const dialog = page.getByRole("dialog", { name: "ტრანზაქციის წაშლა" });
    await dialog.getByRole("button", { name: "წაშლა", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(
      page.locator("tbody tr").filter({ hasText: "USD" }),
    ).toHaveCount(0);
    expect(
      (await db.query("SELECT id FROM transactions WHERE id=$1", [deposit]))
        .rows,
    ).toHaveLength(0);
    await page.getByRole("link", { name: "მიმოხილვა", exact: true }).click();
    await expect(summary).toContainText("$300,00");
    await expect(summary).toContainText("$100,00");
    await expect(summary).not.toContainText("$1 300,00");
    await page.goto("/portfolios");
    await expect(
      page.getByRole("link", { name: `${name} — გახსნა`, exact: true }),
    ).toContainText("$300,00");
  } finally {
    await db.end();
  }
});
