import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

test("portfolio analysis merges sources, capital, risk and legacy navigation", async ({
  page,
}, info) => {
  test.skip(
    process.env.CCX_E2E_STATISTICS_FIXTURES !== "1",
    "Requires isolated provider fixtures",
  );
  test.setTimeout(360000);
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
  const portfolioId = randomUUID();
  const db = new Client({
    connectionString: "postgresql://postgres:postgres@127.0.0.1:55439/postgres",
  });
  await db.connect();
  try {
    await db.query(
      "INSERT INTO portfolios (id,user_id,name) VALUES ($1,$2,$3)",
      [portfolioId, user, "შედეგის ანალიზი"],
    );
    await db.query(
      "INSERT INTO assets (id,symbol,name,provider_id) VALUES ('bitcoin','BTC','Bitcoin','bitcoin'),('USD','USD','Cash','USD') ON CONFLICT DO NOTHING",
    );
    await db.query(
      "INSERT INTO market_quotes (asset_id,price,quoted_at) VALUES ('bitcoin',3000,now()) ON CONFLICT (asset_id) DO UPDATE SET price=3000,quoted_at=now(),fetched_at=now()",
    );
    for (const [asset, kind, quantity, price, hours, seq] of [
      ["USD", "deposit", "10000", null, 30, 0],
      ["bitcoin", "buy", "1", "1000", 12, 1],
      ["bitcoin", "sell", "0.25", "1200", 6, 2],
    ])
      await db.query(
        "INSERT INTO transactions (id,portfolio_id,asset_id,kind,quantity,price,occurred_at,sequence) VALUES ($1,$2,$3,$4,$5,$6,now()-($7 * interval '1 hour'),$8)",
        [randomUUID(), portfolioId, asset, kind, quantity, price, hours, seq],
      );
    for (const [days, value, cash, realized, unrealized] of [
      [1, "10000", "10000", "0", "0"],
      [0, "11550", "9300", "50", "1500"],
    ])
      await db.query(
        "INSERT INTO portfolio_snapshots (id,portfolio_id,day,captured_at,value,cash,realized_pnl,unrealized_pnl,revision) VALUES ($1,$2,(now()-($3 * interval '1 day'))::date,now()-($3 * interval '1 day'),$4,$5,$6,$7,1)",
        [randomUUID(), portfolioId, days, value, cash, realized, unrealized],
      );
  } finally {
    await db.end();
  }
  const base = `/portfolios/${portfolioId}`;
  await page.goto(base + "/analytics");
  await expect(page).toHaveURL(new RegExp(`/statistics\\?tab=portfolio$`));
  const capital = page.getByRole("region", { name: "კაპიტალი და შედეგი" });
  await expect(capital).toContainText("$10 000,00");
  await expect(capital).toContainText("$11 550,00");
  await expect(capital).toContainText("$1 550,00");
  await capital
    .getByText("კაპიტალის მოძრაობა და შემოსავლიანობა", { exact: true })
    .click();
  await expect(capital.getByText("+15,5%", { exact: true })).toBeVisible();
  const sources = page.getByRole("region", {
    name: "რა ქმნის მოგებას და ზარალს",
  });
  await expect(sources.getByRole("link")).toContainText("BTC");
  await expect(sources.getByRole("link")).toContainText("$1 550,00");
  const risk = page.getByRole("region", { name: "სად არის მთავარი რისკი" });
  await expect(risk).toContainText("კონცენტრაცია: მაღალი");
  await expect(page.locator('a[href$="/analytics"]')).toHaveCount(0);
  await sources
    .getByText("ყველა აქტივის წვლილი და სექტორები", { exact: true })
    .click();
  await expect(
    sources.getByRole("heading", { name: "აქტივების წვლილი", exact: true }),
  ).toBeVisible();
  await sources
    .getByText("ყველა აქტივის წვლილი და სექტორები", { exact: true })
    .click();
  await capital
    .getByText("კაპიტალის მოძრაობა და შემოსავლიანობა", { exact: true })
    .click();
  for (const width of [360, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(
      page.getByRole("heading", { name: "კაპიტალი და შედეგი", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.local/portfolio-analysis-${width}.png`,
      fullPage: true,
    });
  }
  await page
    .getByRole("button", { name: "თანხების დამალვა", exact: true })
    .click();
  await expect(capital).not.toContainText("$1 550,00");
  await expect(sources).not.toContainText("$1 550,00");
  await expect(capital).not.toContainText("+15,5%");
  await page
    .getByRole("button", { name: "თანხების ჩვენება", exact: true })
    .click();
  await sources.getByRole("link").first().click();
  await expect(page).toHaveURL(new RegExp(`/positions/bitcoin$`));
  for (const route of [
    "",
    "/positions",
    "/transactions",
    "/airdrops",
    "/watchlist",
    "/allocation",
    "/strategy",
    "/scenarios",
    "/journal",
    "/settings",
  ]) {
    await page.goto(base + route);
    await expect(page.locator("main")).toBeVisible();
    for (const width of [360, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `${route} at ${width}`,
      ).toBe(true);
      await page.screenshot({
        path: `.local/system-${route.slice(1) || "overview"}-${width}.png`,
        fullPage: true,
      });
    }
  }
  const mutate = new Client({
    connectionString: "postgresql://postgres:postgres@127.0.0.1:55439/postgres",
  });
  await mutate.connect();
  try {
    await mutate.query(
      "UPDATE market_quotes SET quoted_at=now()-interval '2 days',fetched_at=now() WHERE asset_id='bitcoin'",
    );
  } finally {
    await mutate.end();
  }
  await page.goto(base + "/statistics?tab=portfolio");
  await expect(
    page.getByRole("region", { name: "სად არის მთავარი რისკი" }),
  ).toContainText("მოძველებული: 1");
  await expect(
    page.getByRole("region", { name: "რა ქმნის მოგებას და ზარალს" }),
  ).toContainText("სანდო განაწილებისთვის");
});
