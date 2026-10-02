import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { Client } from "pg";

test("king share exports landscape profit and loss with privacy and legacy templates", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const db = new Client({
    connectionString: "postgresql://postgres:postgres@127.0.0.1:55439/postgres",
  });
  await db.connect();
  const id = crypto.randomUUID();
  try {
    await db.query(
      "INSERT INTO portfolios (id,user_id,name) VALUES ($1,$2,'King share test')",
      [id, `alice-${info.project.name}`],
    );
    await db.query(
      "INSERT INTO assets (id,symbol,name,provider_id) VALUES ('king-test','KING','გრძელი სატესტო აქტივი','king-test') ON CONFLICT DO NOTHING",
    );
    await db.query(
      "INSERT INTO assets (id,symbol,name,provider_id) VALUES ('USD','USD','US Dollar','USD') ON CONFLICT DO NOTHING",
    );
    await db.query(
      "INSERT INTO transactions (id,portfolio_id,asset_id,kind,quantity,occurred_at,sequence) VALUES (gen_random_uuid(),$1,'USD','deposit',1000,now()-interval '1 minute',0)",
      [id],
    );
    await db.query(
      "INSERT INTO transactions (id,portfolio_id,asset_id,kind,quantity,price,occurred_at,sequence) VALUES (gen_random_uuid(),$1,'king-test','buy',1,100,now(),1)",
      [id],
    );
    const cookies = JSON.parse(
      await readFile(".local/e2e-cookies.json", "utf8"),
    );
    await page.context().addCookies([
      {
        name: "better-auth.session_token",
        value: cookies[`alice-${info.project.name}`],
        domain: "localhost",
        path: "/",
      },
    ]);
    for (const [state, price] of [
      ["profit", 124.68],
      ["loss", 75.32],
    ] as const) {
      await db.query(
        "INSERT INTO market_quotes (asset_id,price,quoted_at) VALUES ('king-test',$1,now()) ON CONFLICT (asset_id) DO UPDATE SET price=$1,quoted_at=now(),fetched_at=now()",
        [price],
      );
      await page.goto(`/portfolios/${id}/positions/king-test`);
      await page
        .getByRole("button", { name: "გაზიარება", exact: true })
        .click();
      await page
        .getByRole("tab", { name: "მეფე და დათვი", exact: true })
        .click();
      const png = page.getByRole("button", { name: "PNG", exact: true });
      await expect(png).toBeEnabled({ timeout: 25000 });
      const canvas = page.locator("dialog[open] canvas");
      await expect(canvas).toHaveAttribute("width", "1586");
      await expect(canvas).toHaveAttribute("height", "1000");
      await expect(canvas).toHaveCSS("border-top-width", "0px");
      const download = page.waitForEvent("download");
      await png.click();
      await (
        await download
      ).saveAs(`.local/king-share-${state}-${info.project.name}.png`);
      await page
        .locator("dialog[open]")
        .getByRole("button", { name: "თანხების დამალვა", exact: true })
        .click();
      await expect(png).toBeEnabled();
      await expect(page.locator("#position-share-data")).toContainText(
        "დამალულია",
      );
      await page
        .locator("dialog[open]")
        .getByRole("button", { name: "თანხების ჩვენება", exact: true })
        .click();
      await page.getByRole("tab", { name: "კლასიკური", exact: true }).click();
      await expect(png).toBeEnabled({ timeout: 25000 });
      await expect(canvas).toHaveAttribute("width", "1080");
      await page.keyboard.press("Escape");
    }
  } finally {
    await db.query("DELETE FROM portfolios WHERE id=$1", [id]);
    await db.end();
  }
});
