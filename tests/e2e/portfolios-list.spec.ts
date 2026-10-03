import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

test("portfolio cards, responsive layout, privacy and creation dialog", async ({
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
  await page.goto("/portfolios");
  await expect(page.getByText("შექმენით პირველი პორტფელი.")).toBeVisible();
  const db = new Client({
    connectionString: "postgresql://postgres:postgres@127.0.0.1:55439/postgres",
  });
  await db.connect();
  const ids = [randomUUID(), randomUUID()];
  try {
    await db.query(
      "INSERT INTO assets (id,symbol,name,provider_id,category) VALUES ('USD','USD','Cash','USD','cash') ON CONFLICT DO NOTHING",
    );
    for (const [index, id] of ids.entries()) {
      await db.query(
        "INSERT INTO portfolios (id,user_id,name) VALUES ($1,$2,$3)",
        [
          id,
          user,
          index === 0
            ? "კრიპტო კოლექტივი — ძალიან გრძელი პორტფელის სახელი"
            : "2026 კაპიტალი",
        ],
      );
      await db.query(
        "INSERT INTO transactions (id,portfolio_id,asset_id,kind,quantity,occurred_at,sequence) VALUES ($1,$2,'USD','deposit',$3,now(),0)",
        [randomUUID(), id, index === 0 ? "21945.70" : "1000"],
      );
    }
    await db.query(
      "INSERT INTO assets (id,symbol,name,provider_id) VALUES ('bitcoin','BTC','Bitcoin','bitcoin') ON CONFLICT DO NOTHING",
    );
    await db.query(
      "INSERT INTO market_quotes (asset_id,price,quoted_at) VALUES ('bitcoin',2500,now()) ON CONFLICT (asset_id) DO UPDATE SET price=2500,quoted_at=now(),fetched_at=now()",
    );
    await db.query(
      "INSERT INTO transactions (id,portfolio_id,asset_id,kind,quantity,price,occurred_at,sequence) VALUES ($1,$2,'bitcoin','buy',1,3000,now(),1)",
      [randomUUID(), ids[0]],
    );
  } finally {
    await db.end();
  }
  await page.reload();
  const card = page.locator(`a[href="/portfolios/${ids[0]}"]`);
  await expect(card.getByText("ლიკვიდობა")).toBeVisible();
  await expect(card.getByText("1 კრიპტოაქტივი")).toBeVisible();
  await expect(card.getByText("-$500,00")).toBeVisible();
  for (const width of [360, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(
      page.getByRole("button", { name: "პორტფელის შექმნა", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.local/portfolios-${width}.png`,
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "თანხების დამალვა" }).click();
  await expect(card.locator(".balance-value").first()).toHaveText("••••••");
  await page
    .getByRole("button", { name: "პორტფელის შექმნა", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByLabel("პორტფელის სახელი"),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await card.click();
  await expect(page).toHaveURL(new RegExp(`/portfolios/${ids[0]}$`));
});
