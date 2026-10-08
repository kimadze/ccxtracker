import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

test("populated position cards, filters and mobile rows keep their hierarchy and links", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const cookies = JSON.parse(await readFile(".local/e2e-cookies.json", "utf8"));
  const user = `alice-${info.project.name}`;
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
  const id = randomUUID();
  await db.connect();
  try {
    let sequence = 0;
    await db.query(
      "INSERT INTO portfolios (id,user_id,name) VALUES ($1,$2,'პოზიციების ვიზუალური შემოწმება')",
      [id, user],
    );
    for (const [asset, symbol, name, price, basis] of [
      ["ui-soph", "SOPH", "SophiaVerse", "0.00086946", "0.006525"],
      ["ui-xch", "XCH", "Chia", "1.47", "11.569059"],
      [
        "ui-long",
        "FET",
        "ხელოვნური ინტელექტის გაერთიანება ძალიან გრძელი ქართული სახელით",
        "0.231028",
        "0.1",
      ],
      ["ui-unknown", "UNK", "უცნობი ფასი", null, "1"],
    ] as const) {
      await db.query(
        "INSERT INTO assets (id,symbol,name,provider_id) VALUES ($1,$2,$3,$1) ON CONFLICT DO NOTHING",
        [asset, symbol, name],
      );
      if (price)
        await db.query(
          "INSERT INTO market_quotes (asset_id,price,quoted_at) VALUES ($1,$2,now()) ON CONFLICT (asset_id) DO UPDATE SET price=$2,quoted_at=now(),fetched_at=now()",
          [asset, price],
        );
      await db.query(
        "INSERT INTO transactions (id,portfolio_id,asset_id,kind,quantity,price,occurred_at,sequence) VALUES ($1,$2,$3,'deposit',1000,$4,now(),$5)",
        [randomUUID(), id, asset, basis, ++sequence],
      );
    }
  } finally {
    await db.end();
  }
  const base = `/portfolios/${id}`;
  await page.goto(`${base}/positions`);
  for (const width of [360, 390, 430, 768, 1024, 1440, 1874]) {
    await page.setViewportSize({ width, height: 900 });
    if (width >= 1024) {
      await page.getByRole("button", { name: "ცხრილის ხედი" }).click();
      await page.screenshot({
        path: `.local/positions-controls-table-${width}-${info.project.name}.png`,
        fullPage: true,
      });
      await page.getByRole("button", { name: "ბარათების ხედი" }).click();
      await expect(page.locator("article.card")).toHaveCount(4);
      const cards = page.locator("article.card");
      expect(
        await cards.evaluateAll((els) =>
          els.every((el) => el.scrollWidth <= el.clientWidth + 1),
        ),
      ).toBe(true);
      await expect(
        page.getByRole("link", { name: "SOPH — გეგმა", exact: true }),
      ).toHaveAttribute("href", `${base}/positions/ui-soph?tab=exit`);
      await expect(
        page.getByRole("link", { name: "SOPH — ჟურნალი", exact: true }),
      ).toHaveAttribute("href", `${base}/positions/ui-soph?tab=journal`);
      const filter = page.getByRole("group", {
        name: "პოზიციების ფილტრები",
        exact: true,
      });
      await filter.getByRole("button", { name: /^ზარალში/ }).click();
      await expect(cards).toHaveCount(2);
      await filter.getByRole("button", { name: /^ფასის გარეშე/ }).click();
      await expect(cards).toHaveCount(1);
      await filter.getByRole("button", { name: /^ყველა/ }).click();
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.local/positions-refined-${width}-${info.project.name}.png`,
      fullPage: true,
    });
  }
  await page
    .getByRole("button", { name: "თანხების დამალვა", exact: true })
    .click();
  await expect(page.locator("article.card .balance-value").first()).toHaveText(
    "••••••",
  );
  await page
    .getByRole("button", { name: "თანხების ჩვენება", exact: true })
    .click();
  await page
    .getByRole("link", { name: "SOPH — დეტალები", exact: true })
    .click();
  await expect(page).toHaveURL(
    `${page.url().split("/portfolios/")[0]}${base}/positions/ui-soph`,
  );
});
