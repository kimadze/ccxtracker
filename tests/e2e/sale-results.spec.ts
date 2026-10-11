import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client } from "pg";

test("partial sales stay visible in position and transaction history", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const cookies = JSON.parse(await readFile(".local/e2e-cookies.json", "utf8"));
  const user = `alice-${info.project.name}`;
  await page
    .context()
    .addCookies([
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
  const pid = randomUUID();
  const asset = `sale-${info.project.name}`;
  await db.connect();
  try {
    await db.query("INSERT INTO portfolios(id,user_id,name) VALUES($1,$2,$3)", [
      pid,
      user,
      "ნაწილობრივი გაყიდვის შემოწმება",
    ]);
    await db.query(
      "INSERT INTO assets(id,symbol,name,provider_id) VALUES($1,'BTC','გრძელი ქართული აქტივის სახელი',$1) ON CONFLICT DO NOTHING",
      [asset],
    );
    await db.query(
      "INSERT INTO market_quotes(asset_id,price,quoted_at) VALUES($1,15,now()) ON CONFLICT(asset_id) DO UPDATE SET price=15,quoted_at=now(),fetched_at=now()",
      [asset],
    );
    await db.query(
      "INSERT INTO transactions(id,portfolio_id,asset_id,kind,quantity,price,fee,occurred_at,sequence) VALUES($1,$2,$3,'deposit',100,10,0,now()-interval '1 day',1)",
      [randomUUID(), pid, asset],
    );
    await db.query(
      "INSERT INTO transactions(id,portfolio_id,asset_id,kind,quantity,price,fee,occurred_at,sequence) VALUES($1,$2,$3,'sell',40,15,2,now(),2)",
      [randomUUID(), pid, asset],
    );
    await page.goto(`/portfolios/${pid}/positions/${asset}`);
    const pnl = page.getByLabel("პოზიციის მოგება და ზარალი");
    for (const [label, value] of [
      ["დაფიქსირებული P/L", "$198,00"],
      ["დარჩენილი პოზიციის P/L", "$300,00"],
      ["სრული P/L", "$498,00"],
    ]) {
      await expect(
        pnl.locator(".stat").filter({ hasText: label }),
      ).toContainText(value);
    }
    for (const width of [360, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `.local/position-sale-${width}-${info.project.name}.png`,
      });
    }
    await page.getByRole("button", { name: "თანხების დამალვა" }).click();
    for (const value of await pnl.locator(".balance-value").all())
      await expect(value).toContainText("••••••");
    await page.getByRole("button", { name: "თანხების ჩვენება" }).click();
    await page.getByRole("tab", { name: "ტრანზაქციები", exact: true }).click();
    await expect(
      page
        .getByRole("tabpanel")
        .getByText("$198,00", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    await page.goto(`/portfolios/${pid}/transactions`);
    await expect(
      page.getByText("$198,00", { exact: true }).filter({ visible: true }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    const sale = page.locator("li.list-row").filter({ hasText: "გაყიდვა" });
    await expect(sale).toContainText("გაყიდვის P/L: $198,00");
    await sale.locator("summary").click();
    await expect(sale).toContainText("$598,00");
    await expect(sale).toContainText("$400,00");
    await page.screenshot({
      path: `.local/sale-history-390-${info.project.name}.png`,
    });
  } finally {
    await db.query("DELETE FROM portfolios WHERE id=$1", [pid]);
    await db.end();
  }
});
