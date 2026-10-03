import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

test("statistics periods, owned assets, macro trends and responsive layouts", async ({
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
        "INSERT INTO market_quotes (asset_id,price,quoted_at) VALUES ($1,3000,now()) ON CONFLICT (asset_id) DO UPDATE SET quoted_at=now(),fetched_at=now()",
        [id],
      );
      await db.query(
        "INSERT INTO transactions (id,portfolio_id,asset_id,kind,quantity,occurred_at,sequence) VALUES ($1,$2,$3,'deposit',1,now(),$4)",
        [randomUUID(), portfolioId, id, index],
      );
    }
  } finally {
    await db.end();
  }
  const base = `/portfolios/${portfolioId}/statistics`;
  await page.goto(base);
  const panel = page.getByRole("tabpanel");
  await expect(
    panel.getByText("დაფარვა: 4/5 აქტივი · 1 ცვლილება მიუწვდომელია"),
  ).toBeVisible();
  const gainers = panel.locator("section").filter({
    has: page.getByRole("heading", {
      name: "ყველაზე დიდი ზრდა",
      exact: true,
    }),
  });
  await expect(
    gainers.locator("strong").filter({ hasText: /^BTC$/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "1სთ", exact: true }).click();
  await expect(
    gainers.locator("strong").filter({ hasText: /^BTC$/ }),
  ).toHaveCount(0);
  await expect(
    gainers.locator("strong").filter({ hasText: /^ETH$/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "1სთ", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  for (const width of [360, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.local/statistics-market-${width}.png`,
      fullPage: true,
    });
  }
  await page.getByRole("tab", { name: "ჩემი აქტივები", exact: true }).click();
  await expect(page).toHaveURL(/tab=portfolio/);
  await expect(panel.getByText("საბაზრო დაფარვა: 5/6")).toBeVisible();
  const bitcoin = panel.getByRole("link").filter({ hasText: "BTC" });
  await page.getByRole("button", { name: "7დღ", exact: true }).click();
  await expect(bitcoin).toContainText("+10%");
  const uncovered = panel.getByRole("link").filter({ hasText: "UNCOVERED" });
  await expect(uncovered).toContainText("ისტორია მიუწვდომელია");
  await expect(uncovered).toContainText("—");
  for (const width of [360, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.local/statistics-owned-${width}.png`,
      fullPage: true,
    });
  }
  await bitcoin.click();
  await expect(page).toHaveURL(new RegExp(`/positions/bitcoin`));
  await page.goto(base + "?tab=macro");
  await expect(
    panel.getByRole("heading", { name: "FED განაკვეთი", exact: true }),
  ).toBeVisible();
  await expect(panel.getByRole("img")).toHaveCount(8);
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
  await expect(panel.getByText("აქტიური პოზიცია არ არის.")).toBeVisible();
});
