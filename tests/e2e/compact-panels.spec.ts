import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

test("populated airdrop and scenario panels preserve names and complete amounts", async ({
  page,
}, info) => {
  test.setTimeout(180000);
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
  const assetId = `panel-${info.project.name}`;
  const db = new Client({
    connectionString: "postgresql://postgres:postgres@127.0.0.1:55439/postgres",
  });
  await db.connect();
  try {
    await db.query(
      "INSERT INTO portfolios (id,user_id,name) VALUES ($1,$2,$3)",
      [id, `alice-${info.project.name}`, "კომპაქტური პანელების შემოწმება"],
    );
    await db.query(
      "INSERT INTO assets (id,symbol,name,provider_id) VALUES ($1,'LONG','გრძელი აქტივის სახელი',$1)",
      [assetId],
    );
    await db.query(
      "INSERT INTO market_quotes (asset_id,price,quoted_at) VALUES ($1,123.456,now())",
      [assetId],
    );
    await db.query(
      "INSERT INTO transactions (id,portfolio_id,asset_id,kind,quantity,price,occurred_at,sequence,airdrop_source) VALUES ($1,$2,$3,'airdrop',1000000,100,now(),0,$4)",
      [
        randomUUID(),
        id,
        assetId,
        "ძალიან გრძელი წყაროს დასახელება რომელიც რიგის სიგანეს არ უნდა არღვევდეს",
      ],
    );
  } finally {
    await db.end();
  }
  for (const route of ["airdrops", "scenarios"]) {
    await page.goto(`/portfolios/${id}/${route}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    for (const width of [360, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      {
        const values = page.locator(".stat-value");
        expect(await values.count()).toBeGreaterThan(0);
        for (const value of await values.all()) {
          expect(
            await value.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
          ).toBe(true);
        }
      }
      await page.screenshot({
        path: `.local/compact-${route}-${width}-${info.project.name}.png`,
        fullPage: true,
      });
    }
  }
});
