import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

test("watchlist separates prices and alert states across layouts", async ({
  page,
}, info) => {
  test.setTimeout(300000);
  page.setDefaultTimeout(10000);
  const cookies = JSON.parse(await readFile(".local/e2e-cookies.json", "utf8"));
  await page.context().addCookies([
    {
      name: "better-auth.session_token",
      value: cookies[`alice-${info.project.name}`],
      domain: "localhost",
      path: "/",
    },
  ]);
  const id = randomUUID();
  const db = new Client({
    connectionString: "postgresql://postgres:postgres@127.0.0.1:55439/postgres",
  });
  await db.connect();
  try {
    await db.query(
      "INSERT INTO portfolios (id,user_id,name) VALUES ($1,$2,'დაკვირვების სატესტო პორტფელი')",
      [id, `alice-${info.project.name}`],
    );
    await db.query(
      "INSERT INTO assets (id,symbol,name,provider_id) VALUES ('bitcoin','BTC','Bitcoin','bitcoin'),('ethereum','ETH','Ethereum','ethereum'),('watchlist-long','LONG','განსაკუთრებით გრძელი ქართული აქტივის სრული დასახელება','watchlist-long'),('watchlist-done','DONE','Completed target','watchlist-done') ON CONFLICT DO NOTHING",
    );
    await db.query(
      "INSERT INTO market_quotes (asset_id,price,quoted_at) VALUES ('bitcoin',175,now()),('ethereum',0.00000012,now()) ON CONFLICT (asset_id) DO UPDATE SET price=excluded.price,quoted_at=now(),fetched_at=now()",
    );
    await db.query(
      "INSERT INTO watchlist_items (portfolio_id,asset_id,entry_price,exit_price,notes,sell_target_reached_at,sell_target_reached_price) VALUES ($1,'bitcoin',100,200,'სატესტო შენიშვნა',now(),210),($1,'ethereum',null,null,'',null,null),($1,'watchlist-long',0.00001,null,'',null,null)",
      [id],
    );
    await db.query(
      "INSERT INTO watchlist_items(portfolio_id,asset_id,entry_price,target_reached_at,target_reached_price) VALUES($1,'watchlist-done',10,now(),9)",
      [id],
    );
    await page.goto(`/portfolios/${id}/watchlist`);
    await expect(
      page.getByRole("heading", { name: "დაკვირვების სია" }),
    ).toBeVisible();
    for (const width of [360, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
      const content =
        width >= 1024 ? page.locator("table") : page.locator("ul.list");
      await expect(content).toBeVisible();
      await expect(content).toContainText("ფასის ვარდნა ↓");
      await expect(content).toContainText("ფასის ზრდა ↑");
      await expect(content).toContainText("ელოდება");
      await expect(content).not.toContainText("$200");
      await expect(content).not.toContainText("DONE");
      await expect(content).toContainText("ფასი მიუწვდომელია");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `.local/watchlist-redesign-${width}.png`,
        fullPage: true,
      });
      await page.getByRole("button", { name: "მიღწეული", exact: true }).click();
      await expect(content).toContainText("$200");
      await expect(content).not.toContainText("$100");
      await expect(content).not.toContainText("Ethereum");
      await expect(content).toContainText("DONE");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `.local/watchlist-history-${width}.png`,
        fullPage: true,
      });
      await page.getByRole("button", { name: "აქტიური", exact: true }).click();
      const row = (
        width >= 1024
          ? content.locator("tbody tr")
          : content.locator(":scope > li")
      ).filter({ hasText: "Bitcoin" });
      await row.getByRole("button", { name: "BTC სხვა მოქმედებები" }).click();
      await page.screenshot({ path: `.local/watchlist-menu-${width}.png` });
      await row
        .getByRole("button", { name: "დეტალები", exact: true })
        .last()
        .click();
      const details = page.getByRole("dialog", {
        name: "BTC · დეტალები",
        exact: true,
      });
      await expect(details).toContainText("სატესტო შენიშვნა");
      await expect(details).toContainText("დაფიქსირდა");
      await page.keyboard.press("Escape");
      await expect(details).not.toBeVisible();
      await row.getByRole("button", { name: "BTC რედაქტირება" }).click();
      await expect(
        page.getByRole("dialog", { name: "ჩანაწერის რედაქტირება" }),
      ).toBeVisible();
      await expect(page.getByLabel("ალერტის მიმართულება 1")).toHaveValue(
        "below",
      );
      await expect(page.getByLabel("ალერტის მიმართულება 2")).toHaveValue(
        "above",
      );
      await expect(page.getByLabel("ალერტის ფასი 1")).toHaveValue("100");
      await expect(page.getByLabel("ალერტის ფასი 2")).toHaveValue("200");
      await page.screenshot({
        path: `.local/watchlist-direction-form-${width}.png`,
      });
      await page.keyboard.press("Escape");
    }
    const filter = page.getByLabel("დაკვირვების სიის ფილტრი");
    await page.getByRole("button", { name: "მიღწეული", exact: true }).click();
    await expect(page.locator("table tbody tr")).toHaveCount(2);
    await page.getByRole("button", { name: "აქტიური", exact: true }).click();
    await expect(page.locator("table tbody tr")).toHaveCount(3);
    await filter.selectOption("all");
    await page
      .locator("table")
      .getByRole("button", { name: "ETH ფასის ზრდის ალერტის დამატება" })
      .click();
    await expect(page.getByLabel("ალერტის მიმართულება 1")).toHaveValue("above");
    await page.getByLabel("ალერტის ფასი 1").fill("5");
    await page
      .getByRole("dialog", { name: "ჩანაწერის რედაქტირება" })
      .getByRole("button", { name: "შენახვა", exact: true })
      .click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    expect(
      (
        await db.query(
          "SELECT entry_price IS NULL AS below, exit_price=5 AS above FROM watchlist_items WHERE portfolio_id=$1 AND asset_id='ethereum'",
          [id],
        )
      ).rows[0],
    ).toEqual({ below: true, above: true });
    await expect(
      page.locator("table tbody tr").filter({ hasText: "Ethereum" }),
    ).toContainText("$5");
    await page
      .locator("table")
      .getByRole("button", { name: "ETH რედაქტირება" })
      .click();
    await page.getByLabel("ალერტის მიმართულება 1").selectOption("below");
    await page.getByLabel("ალერტის ფასი 1").fill("0.0000001");
    await page
      .getByRole("button", { name: "ალერტის დამატება", exact: true })
      .click();
    await expect(page.getByLabel("ალერტის მიმართულება 2")).toHaveValue("above");
    await page.getByLabel("ალერტის ფასი 2").fill("5");
    await page
      .getByRole("dialog", { name: "ჩანაწერის რედაქტირება" })
      .getByRole("button", { name: "შენახვა", exact: true })
      .click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    expect(
      (
        await db.query(
          "SELECT entry_price=0.0000001 AS below, exit_price=5 AS above FROM watchlist_items WHERE portfolio_id=$1 AND asset_id='ethereum'",
          [id],
        )
      ).rows[0],
    ).toEqual({ below: true, above: true });
    await page.getByLabel("დაკვირვების სიის ძიება").fill("ვერ მოიძებნება");
    await expect(
      page.getByRole("heading", { name: "აქტიური ჩანაწერი ვერ მოიძებნა" }),
    ).toBeVisible();
    await page.getByLabel("დაკვირვების სიის ძიება").fill("");
    await db.query(
      "UPDATE watchlist_items SET target_reached_at=now(),target_reached_price=95 WHERE portfolio_id=$1 AND asset_id='bitcoin'",
      [id],
    );
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      page.locator("table tbody tr").filter({ hasText: "Bitcoin" }),
    ).toHaveCount(0, { timeout: 20000 });
    await page.getByRole("button", { name: "მიღწეული", exact: true }).click();
    await expect(
      page.locator("table tbody tr").filter({ hasText: "Bitcoin" }),
    ).toContainText("$100");
    await page.goto(`/portfolios/${id}/watchlist?asset=bitcoin`);
    await expect(
      page.getByRole("button", { name: "მიღწეული", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  } finally {
    await db.end();
  }
});
