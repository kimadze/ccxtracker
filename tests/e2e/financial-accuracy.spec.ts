import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

test("tiny scenario prices, legacy liquidity, closed positions and wallet quote age remain accurate", async ({
  page,
}, info) => {
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
  const db = new Client({
    connectionString: "postgresql://postgres:postgres@127.0.0.1:55439/postgres",
  });
  await db.connect();
  const pid = randomUUID(),
    wid = randomUUID();
  const tiny = `tiny-${randomUUID()}`,
    missing = `missing-${randomUUID()}`,
    closed = `closed-${randomUUID()}`;
  try {
    await db.query(
      "INSERT INTO portfolios(id,user_id,name) VALUES($1,$2,'ფინანსური სიზუსტის შემოწმება')",
      [pid, user],
    );
    for (const [id, symbol] of [
      [tiny, "TINY"],
      [missing, "NONE"],
      [closed, "CLOSED"],
    ])
      await db.query(
        "INSERT INTO assets(id,provider_id,symbol,name) VALUES($1,$1,$2,$2)",
        [id, symbol],
      );
    await db.query(
      "INSERT INTO assets(id,provider_id,symbol,name,is_stablecoin,category) VALUES('dai','dai','DAI','Dai',false,'other') ON CONFLICT(id) DO UPDATE SET is_stablecoin=false,category='other'",
    );
    for (const [id, price] of [
      [tiny, "0.000000000123"],
      ["dai", "0.98"],
    ])
      await db.query(
        "INSERT INTO market_quotes(asset_id,price,quoted_at) VALUES($1,$2,now()) ON CONFLICT(asset_id) DO UPDATE SET price=$2,quoted_at=now(),fetched_at=now()",
        [id, price],
      );
    for (const [index, id] of [tiny, missing, "dai", closed].entries())
      await db.query(
        "INSERT INTO transactions(id,portfolio_id,asset_id,kind,quantity,price,fee,occurred_at,sequence) VALUES(gen_random_uuid(),$1,$2,'deposit',10,1,0,now()-interval '1 day',$3)",
        [pid, id, index + 1],
      );
    await db.query(
      "INSERT INTO transactions(id,portfolio_id,asset_id,kind,quantity,price,fee,occurred_at,sequence) VALUES(gen_random_uuid(),$1,$2,'sell',10,15,2,now(),5)",
      [pid, closed],
    );
    await page.goto(`/portfolios/${pid}/planning?tab=scenarios`);
    await page.getByLabel("საერთო პროცენტული ცვლილება").fill("10,5");
    await page.getByRole("button", { name: "გამოყენება", exact: true }).click();
    await expect(page.getByLabel("TINY — სამიზნე ფასი (USD)")).toHaveValue(
      "0.000000000135915",
    );
    await expect(page.getByLabel("NONE — სამიზნე ფასი (USD)")).toHaveValue("");
    await expect(page.getByLabel("DAI — სამიზნე ფასი (USD)")).toHaveCount(0);
    await page.getByLabel("სცენარის სახელი").fill("მცირე ფასის სცენარი");
    await page.getByRole("button", { name: "შენახვა", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("სცენარი შენახულია");
    const stored = await db.query(
      "SELECT price::text FROM scenario_asset_prices JOIN portfolio_scenarios ON portfolio_scenarios.id=scenario_id WHERE portfolio_id=$1 AND asset_id=$2",
      [pid, tiny],
    );
    expect(stored.rows[0].price).toBe("0.000000000135915000");
    await page.goto(`/portfolios/${pid}/positions/${closed}`);
    await expect(
      page.getByText("დახურული პოზიცია · გაყიდვების შედეგები და ისტორია"),
    ).toBeVisible();
    const pnl = page.getByLabel("პოზიციის მოგება და ზარალი");
    await expect(
      pnl.locator(".stat").filter({ hasText: "დაფიქსირებული P/L" }),
    ).toContainText("$138,00");
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(
        page.getByText("დახურული პოზიცია", { exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `.local/closed-position-${width}-${info.project.name}.png`,
        fullPage: true,
      });
    }
    await page.getByRole("tab", { name: "გეგმა", exact: true }).click();
    await expect(
      page.getByText(
        "პოზიცია დახურულია. ახალი გეგმისთვის ჯერ დაამატეთ აქტივი.",
      ),
    ).toBeVisible();
    await page.getByRole("tab", { name: "ტრანზაქციები", exact: true }).click();
    await expect(
      page
        .getByRole("tabpanel")
        .getByText("$138,00", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    const now = new Date().toISOString();
    const snapshot = {
      fetchedAt: now,
      priceAt: new Date(Date.now() - 3600000).toISOString(),
      knownValue: "10",
      complete: true,
      accounts: [
        {
          address: "test",
          state: "active",
          pending: null,
          reserve: null,
          available: null,
          assets: [
            {
              id: "native",
              symbol: "XLM",
              issuer: null,
              quantity: "100",
              price: "0.1",
              value: "10",
              authorized: true,
            },
          ],
        },
      ],
    };
    await db.query(
      "INSERT INTO wallet_portfolios(id,user_id,name,network,config,snapshot) VALUES($1,$2,'ძველი ფასის შემოწმება','stellar',$3,$4)",
      [
        wid,
        user,
        JSON.stringify({ addresses: ["test"] }),
        JSON.stringify(snapshot),
      ],
    );
    await page.clock.install();
    await page.goto(`/wallet-portfolios/${wid}`);
    await expect(page.getByText("მოძველებულია", { exact: true })).toBeVisible();
    await db.query("UPDATE wallet_portfolios SET snapshot=$2 WHERE id=$1", [
      wid,
      JSON.stringify({ ...snapshot, priceAt: now }),
    ]);
    await page.reload();
    await expect(page.getByText("განახლებულია", { exact: true })).toBeVisible();
    await page.clock.fastForward(16 * 60000);
    await expect(page.getByText("მოძველებულია", { exact: true })).toBeVisible();
    for (const width of [360, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `.local/financial-wallet-${width}-${info.project.name}.png`,
      });
    }
  } finally {
    await db.query("DELETE FROM wallet_portfolios WHERE id=$1", [wid]);
    await db.query("DELETE FROM portfolios WHERE id=$1", [pid]);
    await db.end();
  }
});
