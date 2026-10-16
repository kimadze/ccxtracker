import { test, expect } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

test("USDT trades, actual-currency history and separate balances work at every breakpoint", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);
  const cookies = JSON.parse(await readFile(".local/e2e-cookies.json", "utf8"));
  const user = `alice-${info.project.name}`,
    id = randomUUID(),
    asset = `settlement-${info.project.name}`;
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
  await db.connect();
  try {
    await db.query(
      "INSERT INTO portfolios(id,user_id,name,revision) VALUES($1,$2,$3,1)",
      [id, user, "საფულე ძალიან გრძელი ქართული დასახელებით"],
    );
    await db.query(
      "INSERT INTO assets(id,symbol,name,provider_id) VALUES($1,'STRK','Starknet',$1)",
      [asset],
    );
    await db.query(
      "INSERT INTO transactions(id,portfolio_id,asset_id,kind,quantity,price,sequence,occurred_at) VALUES($1,$2,$3,'deposit',1000,0.1,1,'2026-01-01')",
      [randomUUID(), id, asset],
    );
    await db.query(
      "INSERT INTO market_quotes(asset_id,price,quoted_at) VALUES($1,0.12,now()),('tether',0.99,now()) ON CONFLICT(asset_id) DO UPDATE SET price=excluded.price,quoted_at=now(),fetched_at=now()",
      [asset],
    );
    const base = `/portfolios/${id}`;
    await page.goto(`${base}/transactions?new=1`);
    const dialog = page.getByRole("dialog", {
      name: "ტრანზაქციის დამატება",
      exact: true,
    });
    await dialog.getByLabel("ტრანზაქციის ტიპი").selectOption("sell");
    await dialog.getByLabel("აქტივი", { exact: true }).selectOption(asset);
    await expect(dialog.getByLabel("ანგარიშსწორების ვალუტა")).toHaveValue(
      "tether",
    );
    await dialog.locator("input[name='quantity']").fill("500");
    await dialog.locator("input[name='price']").fill("0.12");
    await expect(
      dialog.getByRole("heading", { name: /ცვლილების შედეგი/ }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "შენახვა", exact: true }),
    ).toBeEnabled({ timeout: 20000 });
    await mkdir(".local/settlement-preview", { recursive: true });
    for (const width of [360, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      expect(
        await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
      await page.screenshot({
        path: `.local/settlement-preview/form-${info.project.name}-${width}.png`,
      });
    }
    await dialog.getByRole("button", { name: "შენახვა", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    const sale = (
      await db.query(
        "SELECT settlement_asset_id FROM transactions WHERE portfolio_id=$1 AND kind='sell'",
        [id],
      )
    ).rows[0];
    expect(sale.settlement_asset_id).toBe("tether");
    expect(
      Number(
        (
          await db.query(
            "SELECT quantity FROM positions WHERE portfolio_id=$1 AND asset_id='tether'",
            [id],
          )
        ).rows[0].quantity,
      ),
    ).toBe(60);
    await expect(page.getByText(/60 USDT/).first()).toBeVisible();
    await page.goto(base);
    const balances = page.getByRole("region", {
      name: "USD ნაშთი და სტეიბლკოინები",
    });
    await expect(balances).toContainText("ნაღდი ფული");
    await expect(balances).toContainText("60 USDT");
    await expect(balances).toContainText("59,40");
    for (const width of [360, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `.local/settlement-preview/overview-${info.project.name}-${width}.png`,
        fullPage: true,
      });
    }
  } finally {
    await db.end();
  }
});
