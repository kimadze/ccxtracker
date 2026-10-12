import { test, expect } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
test("AI fills a draft, waits for confirmation and fits responsive dialogs", async ({
  page,
}, info) => {
  test.skip(
    process.env.CCX_E2E_AI_FIXTURES !== "1",
    "Requires isolated AI transport",
  );
  test.setTimeout(180000);
  const cookies = JSON.parse(await readFile(".local/e2e-cookies.json", "utf8")),
    user = `alice-${info.project.name}`,
    pid = randomUUID(),
    asset = `xlm-ai-${randomUUID()}`;
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
    await db.query("INSERT INTO portfolios(id,user_id,name) VALUES($1,$2,$3)", [
      pid,
      user,
      "AI მონახაზის შემოწმება",
    ]);
    await db.query(
      "DELETE FROM assets WHERE symbol='XLM' AND id NOT IN (SELECT asset_id FROM transactions)",
    );
    await db.query(
      "INSERT INTO assets(id,symbol,name,provider_id) VALUES($1,'XLM','Stellar',$1)",
      [asset],
    );
    await db.query(
      "INSERT INTO transactions(id,portfolio_id,asset_id,kind,quantity,price,fee,occurred_at,sequence) VALUES($1,$2,$3,'deposit',1000,0.1,0,now()-interval '1 day',1)",
      [randomUUID(), pid, asset],
    );
    await page.goto(`/portfolios/${pid}/transactions?new=1`);
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByText("ტექსტით შევსება", { exact: true }).click();
    await dialog
      .getByRole("textbox", { name: "ტრანზაქციის აღწერა" })
      .fill("გავყიდე 500 XLM თითო $0.12-ად");
    await dialog.getByRole("button", { name: "მონახაზის მომზადება" }).click();
    const choice = dialog.getByRole("combobox", { name: "დააზუსტე აქტივი" });
    await expect(
      dialog.getByRole("button", { name: "ფორმაში გადატანა" }),
    ).toBeVisible();
    if (await choice.count()) await choice.selectOption(asset);
    await expect(
      dialog.getByRole("button", { name: "ფორმაში გადატანა" }),
    ).toBeEnabled();
    expect(
      (
        await db.query(
          "SELECT count(*) FROM transactions WHERE portfolio_id=$1",
          [pid],
        )
      ).rows[0].count,
    ).toBe("1");
    await dialog.getByRole("button", { name: "ფორმაში გადატანა" }).click();
    await expect(
      dialog
        .locator("details")
        .filter({ has: page.getByText("ტექსტით შევსება", { exact: true }) }),
    ).not.toHaveAttribute("open");
    await expect(dialog.locator("input[name='quantity']")).toHaveValue("500");
    await expect(dialog.locator("input[name='price']")).toHaveValue("0.12");
    const save = dialog.getByRole("button", { name: "შენახვა", exact: true });
    await expect(save).toBeEnabled({ timeout: 20000 });
    await mkdir(".local/ai-screenshots", { recursive: true });
    for (const width of [360, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
      await expect
        .poll(() =>
          dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        )
        .toBe(true);
      await page.screenshot({
        path: `.local/ai-screenshots/${info.project.name}-${width}.png`,
      });
    }
    await save.click();
    await expect(dialog).not.toBeVisible();
    const rows = (
      await db.query(
        "SELECT kind,quantity,price FROM transactions WHERE portfolio_id=$1 ORDER BY sequence",
        [pid],
      )
    ).rows;
    expect(rows).toHaveLength(2);
    expect(rows[1].kind).toBe("sell");
    expect(Number(rows[1].quantity)).toBe(500);
  } finally {
    await db.end();
  }
});
