import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
test("opening batch, previews, undo, planning and target notices work at all breakpoints", async ({
  page,
}, info) => {
  test.setTimeout(300000);
  page.setDefaultTimeout(10000);
  const cookies = JSON.parse(await readFile(".local/e2e-cookies.json", "utf8"));
  const user = `alice-${info.project.name}`,
    id = randomUUID(),
    name = `ახალი შესაძლებლობები ${info.project.name}`;
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
  await db.connect();
  try {
    await db.query(
      "INSERT INTO portfolios (id,user_id,name) VALUES ($1,$2,$3)",
      [id, user, name],
    );
    await db.query(
      "INSERT INTO assets (id,symbol,name,provider_id) VALUES ('USD','USD','Cash','usd'),('bitcoin','BTC','Bitcoin','bitcoin'),('ethereum','ETH','Ethereum','ethereum') ON CONFLICT DO NOTHING",
    );
    await db.query(
      "INSERT INTO market_quotes (asset_id,price,quoted_at) VALUES ('bitcoin',175,now()),('ethereum',25,now()) ON CONFLICT (asset_id) DO UPDATE SET price=excluded.price,quoted_at=now(),fetched_at=now()",
    );
    await db.query(
      "INSERT INTO watchlist_items (portfolio_id,asset_id,entry_price) VALUES ($1,'bitcoin',175)",
      [id],
    );
    const base = `/portfolios/${id}`;
    await page.goto(`${base}/positions`);
    await expect(
      page.getByRole("button", { name: /შეტყობინებები · 1 წაუკითხავი/ }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "დამატების ვარიანტები", exact: true })
      .click();
    await page
      .getByRole("button", { name: "რამდენიმე აქტივის დამატება", exact: true })
      .click();
    const form = page.getByRole("dialog", {
      name: "არსებული აქტივების დამატება",
      exact: true,
    });
    await form.getByLabel("აქტივი 1", { exact: true }).selectOption("bitcoin");
    await form.getByLabel("რაოდენობა", { exact: true }).fill("2");
    await form
      .getByLabel("საშუალო ფასი (არასავალდებულო)", { exact: true })
      .fill("0");
    await form.getByRole("button", { name: /რიგის დამატება/ }).click();
    await form.getByLabel("აქტივი 2", { exact: true }).selectOption("bitcoin");
    await expect(form).toContainText("ერთი აქტივი მხოლოდ ერთხელ აირჩიეთ.");
    await expect(
      form.getByRole("button", { name: "ყველას შენახვა", exact: true }),
    ).toBeDisabled();
    await form.getByLabel("აქტივი 2", { exact: true }).selectOption("ethereum");
    await form.getByLabel("რაოდენობა", { exact: true }).nth(1).fill("3");
    await expect(form).toContainText("ცვლილების შედეგი");
    await expect(
      form.getByRole("button", { name: "ყველას შენახვა", exact: true }),
    ).toBeEnabled();
    for (const width of [360, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(
        form.getByRole("button", { name: "ყველას შენახვა", exact: true }),
      ).toBeInViewport();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await form.locator("[data-dialog-scroll]").evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await page.screenshot({
        path: `.local/features-batch-${width}-${info.project.name}.png`,
      });
    }
    await page.setViewportSize({ width: 390, height: 420 });
    await expect(
      form.getByRole("button", { name: "ყველას შენახვა", exact: true }),
    ).toBeInViewport();
    await form
      .getByRole("button", { name: "ყველას შენახვა", exact: true })
      .click();
    await expect(form).not.toBeVisible();
    const stored = await db.query(
      "SELECT asset_id,quantity,price,sequence FROM transactions WHERE portfolio_id=$1 ORDER BY sequence",
      [id],
    );
    expect(stored.rows).toHaveLength(2);
    expect(Number(stored.rows[0].price)).toBe(0);
    expect(stored.rows[1].price).toBeNull();
    expect(stored.rows.map((r) => r.sequence)).toEqual([1, 2]);
    await page.setViewportSize({
      width: info.project.name === "mobile" ? 390 : 1440,
      height: 844,
    });
    await page.goto(`${base}/transactions`);
    const row =
      info.project.name === "desktop"
        ? page.locator("tbody tr").filter({ hasText: "BTC" })
        : page
            .locator("li")
            .filter({ has: page.locator("details") })
            .filter({ hasText: "BTC" });
    if (info.project.name === "mobile") await row.locator("summary").click();
    await row.getByRole("button", { name: /წაშლა/ }).click();
    const deletion = page.getByRole("dialog", {
      name: "ტრანზაქციის წაშლა",
      exact: true,
    });
    await expect(deletion).toContainText("ცვლილების შედეგი");
    await deletion.getByRole("button", { name: "წაშლა", exact: true }).click();
    await expect(deletion).not.toBeVisible();
    await page.getByRole("button", { name: "აღდგენა", exact: true }).click();
    await expect(
      page.locator(".toast .alert"),
    ).toHaveCount(0);
    expect(
      (
        await db.query("SELECT id FROM transactions WHERE portfolio_id=$1", [
          id,
        ])
      ).rows,
    ).toHaveLength(2);
    await page
      .getByRole("button", { name: /შეტყობინებები · 1 წაუკითხავი/ })
      .click();
    const panel = page.getByRole("dialog", {
      name: "შეტყობინებები",
      exact: true,
    });
    await expect(panel).toContainText("BTC · მიზანი მიღწეულია");
    await panel.getByRole("button", { name: /BTC · მიზანი მიღწეულია/ }).click();
    await expect(page).toHaveURL(new RegExp(`/watchlist\\?asset=bitcoin$`));
    await expect(
      page.getByRole("button", { name: "შეტყობინებები", exact: true }),
    ).toBeVisible();
    expect(
      (
        await db.query(
          "SELECT target_read_at FROM watchlist_items WHERE portfolio_id=$1",
          [id],
        )
      ).rows[0].target_read_at,
    ).not.toBeNull();
    for (const tab of ["strategy", "scenarios", "allocation"]) {
      await page.goto(`${base}/${tab}?asset=bitcoin`);
      await expect(page).toHaveURL(
        new RegExp(`/planning\\?asset=bitcoin&tab=${tab}$`),
      );
      await expect(
        page.getByRole("tab", {
          name:
            tab === "strategy"
              ? "სტრატეგია"
              : tab === "scenarios"
                ? "სცენარები"
                : "განაწილება",
          exact: true,
        }),
      ).toHaveAttribute("aria-selected", "true");
      for (const width of [360, 390, 430, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
        await page.screenshot({
          path: `.local/features-planning-${tab}-${width}-${info.project.name}.png`,
        });
      }
    }
    await page.goto(`${base}/planning?tab=scenarios`);
    await page.getByLabel("BTC — სამიზნე ფასი (USD)").fill("200");
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("tab", { name: "სტრატეგია", exact: true }).click();
    await expect(page).toHaveURL(/tab=scenarios$/);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("tab", { name: "სტრატეგია", exact: true }).click();
    await expect(page).toHaveURL(/tab=strategy$/);
  } finally {
    await db.end();
  }
});
