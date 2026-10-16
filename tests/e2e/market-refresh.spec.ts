import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client } from "pg";

test("open overview refreshes valuations without navigating or closing a dialog", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const cookies = JSON.parse(await readFile(".local/e2e-cookies.json", "utf8"));
  await page.context().addCookies([
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
  const pid = randomUUID(),
    asset = `refresh-${info.project.name}`;
  try {
    await db.query(
      "INSERT INTO portfolios(id,user_id,name) VALUES($1,$2,'Refresh test')",
      [pid, `alice-${info.project.name}`],
    );
    await db.query(
      "INSERT INTO assets(id,symbol,name,provider_id) VALUES($1,'RFR','Refresh asset',$1) ON CONFLICT DO NOTHING",
      [asset],
    );
    await db.query(
      "INSERT INTO transactions(id,portfolio_id,asset_id,kind,quantity,price,fee,occurred_at,sequence) VALUES(gen_random_uuid(),$1,$2,'deposit',1,100,0,now(),1)",
      [pid, asset],
    );
    await db.query(
      "INSERT INTO market_quotes(asset_id,price,quoted_at) VALUES($1,100,now()) ON CONFLICT(asset_id) DO UPDATE SET price=100,quoted_at=now(),fetched_at=now()",
      [asset],
    );
    await page.clock.install();
    await page.goto(`/portfolios/${pid}`);
    const summary = page.getByRole("region", {
      name: "პორტფელის ღირებულება და შედეგი",
    });
    await expect(summary).toContainText("$100,00");
    // A real open dialog must suppress the background refresh.
    await page
      .getByRole("button", {
        name:
          info.project.name === "mobile"
            ? "მეტი გვერდი"
            : "ტრანზაქციის დამატება",
        exact: true,
      })
      .click();
    const dialog = page.locator("dialog[open]");
    await expect(dialog).toBeVisible();
    await db.query(
      "UPDATE market_quotes SET price=125,quoted_at=now(),fetched_at=now() WHERE asset_id=$1",
      [asset],
    );
    await page.clock.fastForward(61000);
    await expect(dialog).toBeVisible();
    await expect(summary).toContainText("$100,00");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await page.clock.fastForward(61000);
    await expect(summary).toContainText("$125,00", { timeout: 15000 });
    await expect(page).toHaveURL(new RegExp(`/portfolios/${pid}$`));
  } finally {
    await db.query("DELETE FROM portfolios WHERE id=$1", [pid]);
    await db.end();
  }
});
