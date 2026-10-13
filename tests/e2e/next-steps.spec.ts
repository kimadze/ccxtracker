import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

test("overview next steps show real targets, privacy, empty state and working plan links", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const cookies = JSON.parse(await readFile(".local/e2e-cookies.json", "utf8"));
  const user = `alice-${info.project.name}`,
    pid = randomUUID(),
    asset = `steps-${info.project.name}`,
    plan = randomUUID();
  const db = new Client({
    connectionString: "postgresql://postgres:postgres@127.0.0.1:55439/postgres",
  });
  await db.connect();
  try {
    await db.query("INSERT INTO portfolios(id,user_id,name) VALUES($1,$2,$3)", [
      pid,
      user,
      "ჩემი ნაბიჯები გრძელი ქართული პორტფელის სახელი",
    ]);
    await db.query(
      "INSERT INTO assets(id,symbol,name,provider_id) VALUES($1,'STRK',$2,$1)",
      [asset, "განსაკუთრებით გრძელი ქართული აქტივის დასახელება"],
    );
    await db.query(
      "INSERT INTO transactions(id,portfolio_id,asset_id,kind,quantity,price,sequence,occurred_at) VALUES(gen_random_uuid(),$1,$2,'deposit',100,0,1,now())",
      [pid, asset],
    );
    await db.query(
      "INSERT INTO market_quotes(asset_id,price,quoted_at) VALUES($1,0.1,now())",
      [asset],
    );
    await db.query(
      "INSERT INTO exit_plans(id,portfolio_id,asset_id) VALUES($1,$2,$3)",
      [plan, pid, asset],
    );
    await db.query(
      "INSERT INTO exit_plan_levels(plan_id,level,price,percentage) VALUES($1,1,0.117,20),($1,2,0.2,30)",
      [plan],
    );
    await db.query(
      "INSERT INTO watchlist_items(portfolio_id,asset_id,entry_price,exit_price) VALUES($1,$2,0.08,0.15)",
      [pid, asset],
    );
    for (const [suffix, symbol, target, direction] of [
      ["fall", "XLM", "0.08", "entry_price"],
      ["rise", "ETH", "0.15", "exit_price"],
    ]) {
      const id = `${asset}-${suffix}`;
      await db.query(
        "INSERT INTO assets(id,symbol,name,provider_id) VALUES($1,$2,$2,$1)",
        [id, symbol],
      );
      await db.query(
        "INSERT INTO market_quotes(asset_id,price,quoted_at) VALUES($1,0.1,now())",
        [id],
      );
      await db.query(
        `INSERT INTO watchlist_items(portfolio_id,asset_id,${direction}) VALUES($1,$2,$3)`,
        [pid, id, target],
      );
    }
    await page.context().addCookies([
      {
        name: "better-auth.session_token",
        value: cookies[user],
        domain: "localhost",
        path: "/",
      },
    ]);
    const base = `/portfolios/${pid}`;
    for (const width of [360, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(base);
      const section = page.locator(
        'section[aria-labelledby="next-steps-title"]',
      );
      await expect(
        section.getByRole("heading", { name: "უახლოესი სამიზნეები" }),
      ).toBeVisible();
      await expect(section.locator("li")).toHaveCount(3);
      await expect(
        section.getByText("სამიზნემდე +17%", { exact: true }),
      ).toBeVisible();
      await expect(
        section.getByText("მიღწევა დაფიქსირდა", { exact: true }),
      ).toHaveCount(0);
      await expect(section.getByRole("progressbar")).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if ([390, 1440].includes(width))
        await page.screenshot({
          path: info.outputPath(`next-steps-${width}.png`),
          fullPage: true,
        });
    }
    const section = page.locator('section[aria-labelledby="next-steps-title"]');
    await page
      .getByRole("button", { name: "თანხების დამალვა", exact: true })
      .click();
    await expect(section.getByRole("progressbar")).toHaveCount(0);
    await expect(section.locator(".balance-value").first()).toHaveText(
      "••••••",
    );
    await page
      .getByRole("button", { name: "თანხების ჩვენება", exact: true })
      .click();
    await section.getByRole("link").filter({ hasText: "STRK · TP1" }).click();
    await expect(page).toHaveURL(/tab=exit/);
    await expect(page.getByText("Take Profit", { exact: true })).toBeVisible();
    await db.query(
      "UPDATE market_quotes SET quoted_at=now()-interval '20 minutes' WHERE asset_id LIKE $1",
      [asset + "%"],
    );
    await page.goto(base);
    await expect(
      page
        .locator('section[aria-labelledby="next-steps-title"]')
        .getByText("ფასი მიუწვდომელია", { exact: true }),
    ).toHaveCount(3);
    await db.query("DELETE FROM exit_plans WHERE id=$1", [plan]);
    await db.query("DELETE FROM watchlist_items WHERE portfolio_id=$1", [pid]);
    await page.reload();
    await expect(
      page.getByText("სამიზნეები ჯერ არ გაქვს.", { exact: true }),
    ).toBeVisible();
  } finally {
    await db.end();
  }
});
