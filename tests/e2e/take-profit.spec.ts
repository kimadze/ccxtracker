import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
test("Take Profit alerts save, warn, rearm and fit mobile and desktop", async ({
  page,
}, info) => {
  test.skip(
    process.env.CCX_E2E_TELEGRAM_FIXTURES !== "1",
    "Requires isolated Telegram fixture",
  );
  test.setTimeout(180000);
  const cookies = JSON.parse(await readFile(".local/e2e-cookies.json", "utf8")),
    user = `alice-${info.project.name}`,
    pid = randomUUID();
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
    await db.query("INSERT INTO portfolios(id,user_id,name) VALUES($1,$2,$3)", [
      pid,
      user,
      "Take Profit გრძელი ქართული პორტფელის სახელი",
    ]);
    await db.query(
      "INSERT INTO assets(id,symbol,name,provider_id) VALUES('bitcoin','BTC','Bitcoin','bitcoin') ON CONFLICT DO NOTHING",
    );
    await db.query(
      "INSERT INTO transactions(id,portfolio_id,asset_id,kind,quantity,price,fee,occurred_at,sequence) VALUES($1,$2,'bitcoin','deposit',10,NULL,0,now()-interval '1 day',1)",
      [randomUUID(), pid],
    );
    await db.query(
      "INSERT INTO market_quotes(asset_id,price,quoted_at) VALUES('bitcoin',15,now()) ON CONFLICT(asset_id) DO UPDATE SET price=15,quoted_at=now(),fetched_at=now()",
    );
    await db.query(
      "INSERT INTO telegram_connections(user_id,chat_id,portfolio_ids) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET chat_id=excluded.chat_id",
      [
        user,
        info.project.name === "desktop" ? "123456" : "234567",
        JSON.stringify([pid]),
      ],
    );
    await page.goto(`/portfolios/${pid}/positions/bitcoin?tab=exit`);
    const section = page.locator(".collapse").filter({
      has: page.getByRole("heading", { name: "Take Profit", exact: true }),
    });
    await section.getByLabel("სამიზნე ფასი (USD)").fill("10");
    await section.getByLabel("გასაყიდი წილი (%)").fill("25");
    await section.getByLabel("Telegram ალერტები").check();
    await expect(section).toContainText("ფასი უკვე სამიზნეზეა");
    await section
      .getByRole("button", { name: "ეტაპის დამატება", exact: true })
      .click();
    await section.getByLabel("სამიზნე ფასი (USD)").nth(1).fill("20");
    await section.getByLabel("გასაყიდი წილი (%)").nth(1).fill("50");
    await section
      .getByRole("button", { name: "გეგმის შენახვა", exact: true })
      .click();
    await expect(section).toContainText("გასვლის გეგმა შენახულია");
    const plan = (
      await db.query("SELECT * FROM exit_plans WHERE portfolio_id=$1", [pid])
    ).rows[0];
    expect(plan.telegram_enabled).toBe(true);
    expect(Number(plan.alert_quantity)).toBe(10);
    await page.reload();
    await expect(section.getByLabel("Telegram ალერტები")).toBeChecked();
    await expect(section).toContainText("თვითღირებულება უცნობია");
    for (const width of [360, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await section
        .getByRole("heading", { name: "Take Profit", exact: true })
        .scrollIntoViewIfNeeded();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `.local/take-profit-${width}-${info.project.name}.png`,
      });
    }
    await db.query(
      "UPDATE exit_plan_levels SET reached_at=now(),reached_price=15 WHERE plan_id=$1 AND level=1",
      [plan.id],
    );
    await page.reload();
    await expect(section).toContainText("მიღწეულია");
    await section
      .getByRole("button", { name: "ხელახალი ჩართვა", exact: true })
      .click();
    await expect(section).toContainText("ალერტი ხელახლა ჩართულია");
    expect(
      (
        await db.query(
          "SELECT reached_at FROM exit_plan_levels WHERE plan_id=$1 AND level=1",
          [plan.id],
        )
      ).rows[0].reached_at,
    ).toBeNull();
    await db.query("UPDATE transactions SET quantity=8 WHERE portfolio_id=$1", [
      pid,
    ]);
    await page.reload();
    await expect(section).toContainText("რაოდენობა შეიცვალა");
  } finally {
    await db.query("DELETE FROM portfolios WHERE id=$1", [pid]);
    await db.query("DELETE FROM telegram_connections WHERE user_id=$1", [user]);
    await db.end();
  }
});
