import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

test("portfolio price impact, macro trends and responsive layouts", async ({
  page,
}, info) => {
  test.skip(
    process.env.CCX_E2E_STATISTICS_FIXTURES !== "1",
    "Requires isolated provider fixtures",
  );
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
  const portfolioId = randomUUID(),
    emptyId = randomUUID();
  await db.connect();
  try {
    for (const id of [portfolioId, emptyId])
      await db.query(
        "INSERT INTO portfolios (id,user_id,name) VALUES ($1,$2,$3)",
        [id, user, "სტატისტიკის შემოწმება"],
      );
    for (const [index, id] of [
      "bitcoin",
      "eth",
      "sol",
      "tiny",
      "missing",
      "uncovered",
    ].entries()) {
      await db.query(
        "INSERT INTO assets (id,symbol,name,provider_id) VALUES ($1,$2,$3,$1) ON CONFLICT DO NOTHING",
        [
          id,
          id === "bitcoin" ? "BTC" : id.toUpperCase(),
          "ძალიან გრძელი ქართული აქტივის სახელი",
        ],
      );
      await db.query(
        "INSERT INTO market_quotes (asset_id,price,change_24h,quoted_at) VALUES ($1,3000,$2,now()) ON CONFLICT (asset_id) DO UPDATE SET price=3000,change_24h=$2,quoted_at=now(),fetched_at=now()",
        [id, ["10", "-10", "5", "100", null, null][index]],
      );
      await db.query(
        "INSERT INTO transactions (id,portfolio_id,asset_id,kind,quantity,price,occurred_at,sequence) VALUES ($1,$2,$3,'deposit',1,1000,now(),$4)",
        [randomUUID(), portfolioId, id, index],
      );
    }
    await db.query(
      "UPDATE transactions SET kind='buy',price=6000 WHERE portfolio_id=$1 AND asset_id='bitcoin'",
      [portfolioId],
    );
    await db.query(
      "INSERT INTO assets (id,symbol,name,provider_id,category) VALUES ('USD','USD','Cash','USD','cash') ON CONFLICT DO NOTHING",
    );
    await db.query(
      "INSERT INTO transactions (id,portfolio_id,asset_id,kind,quantity,occurred_at,sequence) VALUES ($1,$2,'USD','deposit',10000,now()-interval '1 day',-1)",
      [randomUUID(), portfolioId],
    );
  } finally {
    await db.end();
  }
  const base = `/portfolios/${portfolioId}/statistics`;
  await page.goto(base);
  const panel = page.getByRole("tabpanel");
  await expect(
    page.getByRole("tab", { name: "ჩემი პორტფელი", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    panel.getByRole("heading", { name: "პოზიციების შედეგები", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "კრიპტო ბაზარი", exact: true }),
  ).toHaveCount(0);
  await page.goto(base + "?tab=market");
  await expect(page).toHaveURL(/tab=portfolio/);
  const sources = panel.getByRole("region", {
    name: "რა ქმნის მოგებას და ზარალს",
  });
  await expect(sources.getByRole("link")).toHaveCount(3);
  expect((await sources.boundingBox())!.height).toBeLessThan(320);
  const priceImpact = panel.getByRole("region", {
    name: "ფასის გავლენა · 24სთ",
  });
  await expect(
    priceImpact.getByText("არასრული ჯამი · შეფასებულია 4/6 აქტივი."),
  ).toBeVisible();
  await expect(
    priceImpact.getByRole("link").filter({ hasText: "BTC" }),
  ).toContainText("$272,73");
  await expect(
    priceImpact.getByRole("link").filter({ hasText: "ETH" }),
  ).toContainText("-$333,33");
  for (const width of [360, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.local/statistics-impact-${width}-${info.project.name}.png`,
      fullPage: true,
    });
  }
  const results = panel.locator("section").filter({
    has: page.getByRole("heading", {
      name: "პოზიციების შედეგები",
      exact: true,
    }),
  });
  await results.getByRole("button", { name: "ზარალში", exact: true }).click();
  await expect(
    results
      .getByRole("link")
      .filter({ hasText: "BTC" })
      .filter({ visible: true }),
  ).toHaveCount(1);
  await expect(
    results
      .getByRole("row")
      .filter({ has: page.getByRole("link").filter({ hasText: "BTC" }) })
      .filter({ visible: true })
      .getByRole("cell")
      .nth(3)
      .locator(":scope > .balance-value"),
  ).toHaveText("-$3 000,00");
  await panel.getByRole("button", { name: "ყველა", exact: true }).click();
  await panel.getByLabel("სტატისტიკის აქტივის ძიება").fill("UNCOVERED");
  await expect(
    panel
      .getByRole("link")
      .filter({ hasText: "UNCOVERED" })
      .filter({ visible: true }),
  ).toHaveCount(1);
  await panel.getByLabel("სტატისტიკის აქტივის ძიება").fill("");
  for (const width of [360, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.local/statistics-working-${width}.png`,
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "თანხების დამალვა" }).click();
  await expect(panel.locator(".balance-value").first()).toContainText("••••••");
  for (const value of await priceImpact.locator(".balance-value").all()) {
    await expect(value).toContainText("••••••");
  }
  await page.getByRole("button", { name: "თანხების ჩვენება" }).click();
  const bitcoin = priceImpact.getByRole("link").filter({ hasText: "BTC" });
  await bitcoin.click();
  await expect(page).toHaveURL(new RegExp(`/positions/bitcoin`));
  await page.goto(base + "?tab=macro");
  await expect(
    panel.getByRole("heading", { name: "FED განაკვეთი", exact: true }),
  ).toBeVisible();
  await expect(panel.getByRole("img")).toHaveCount(7);
  const unavailable = panel.locator("article").filter({
    has: page.getByRole("heading", {
      name: "აშშ 2-წლიანი ობლიგაცია",
      exact: true,
    }),
  });
  await expect(
    unavailable.getByText("ისტორია მიუწვდომელია", { exact: true }),
  ).toBeVisible();
  const fed = panel.locator("article").filter({
    has: page.getByRole("heading", { name: "FED განაკვეთი", exact: true }),
  });
  await fed.getByText("წყარო და შედარება", { exact: true }).click();
  await expect(fed.getByText(/ცვლილება:/)).toBeVisible();
  await expect(fed.getByRole("link")).toHaveAttribute(
    "href",
    "https://fred.stlouisfed.org/series/FEDFUNDS",
  );
  for (const width of [360, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.local/statistics-macro-${width}.png`,
      fullPage: true,
    });
  }
  await page.goto(`/portfolios/${emptyId}/statistics?tab=portfolio`);
  await expect(
    panel.getByText("აქტიური პოზიცია არ არის.").first(),
  ).toBeVisible();
});
