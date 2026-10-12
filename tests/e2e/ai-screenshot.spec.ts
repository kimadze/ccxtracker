import { test, expect } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import sharp from "sharp";
test("private image draft previews, applies and waits for manual save", async ({
  page,
}, info) => {
  test.skip(
    process.env.CCX_E2E_AI_FIXTURES !== "1",
    "Requires fake AI transport",
  );
  test.setTimeout(180000);
  const cookies = JSON.parse(await readFile(".local/e2e-cookies.json", "utf8"));
  const pid = randomUUID(),
    asset = `image-xlm-${randomUUID()}`;
  await page.context().addCookies([
    {
      name: "better-auth.session_token",
      value: cookies["alice-desktop"],
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
      "INSERT INTO portfolios(id,user_id,name) VALUES($1,'alice-desktop',$2)",
      [pid, "სქრინშოტის ტესტი"],
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
    await dialog.getByText("ტექსტით შევსება", { exact: true }).click();
    const input = dialog.locator("input[type='file']");
    const png = await sharp({
      create: { width: 600, height: 300, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    await input.setInputFiles({
      name: "synthetic.png",
      mimeType: "image/png",
      buffer: png,
    });
    await expect(
      dialog.getByAltText("არჩეული ტრანზაქციის სქრინშოტი"),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "სურათის წაშლა" }).click();
    await expect(
      dialog.getByAltText("არჩეული ტრანზაქციის სქრინშოტი"),
    ).toHaveCount(0);
    await input.setInputFiles({
      name: "synthetic.png",
      mimeType: "image/png",
      buffer: png,
    });
    await dialog
      .getByRole("button", { name: "ამოკითხვა", exact: true })
      .click();
    await expect(
      dialog.getByRole("button", { name: "ფორმაში გადატანა" }),
    ).toBeVisible();
    const choice = dialog.getByRole("combobox", { name: "დააზუსტე აქტივი" });
    if (await choice.count()) await choice.selectOption(asset);
    expect(
      (
        await db.query(
          "SELECT count(*) FROM transactions WHERE portfolio_id=$1",
          [pid],
        )
      ).rows[0].count,
    ).toBe("1");
    await mkdir(".local/ai-screenshot-preview", { recursive: true });
    for (const width of [360, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
      await page.screenshot({
        path: `.local/ai-screenshot-preview/${info.project.name}-${width}.png`,
      });
    }
    await dialog.getByRole("button", { name: "ფორმაში გადატანა" }).click();
    await expect(dialog.locator("input[name='quantity']")).toHaveValue("500");
    await expect(dialog.locator("input[name='price']")).toHaveValue("0.12");
    await dialog.getByRole("button", { name: "შენახვა", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    expect(
      (
        await db.query(
          "SELECT count(*) FROM transactions WHERE portfolio_id=$1",
          [pid],
        )
      ).rows[0].count,
    ).toBe("2");
    await page.context().clearCookies();
    await page.context().addCookies([
      {
        name: "better-auth.session_token",
        value: cookies.bob,
        domain: "localhost",
        path: "/",
      },
    ]);
    const forbidden = await page.request.post(
      "/api/ai/transaction-screenshot",
      {
        headers: { origin: "http://localhost:3100" },
        multipart: {
          portfolioId: pid,
          timezone: "Asia/Tbilisi",
          image: { name: "fixture.png", mimeType: "image/png", buffer: png },
        },
      },
    );
    expect(forbidden.status()).toBe(403);
    const bobPortfolio = randomUUID();
    await db.query(
      "INSERT INTO portfolios(id,user_id,name) VALUES($1,'bob','Other account')",
      [bobPortfolio],
    );
    await page.goto(`/portfolios/${bobPortfolio}/transactions?new=1`);
    await page
      .getByRole("dialog")
      .getByText("ტექსტით შევსება", { exact: true })
      .click();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("textbox", { name: "ტრანზაქციის აღწერა" }),
    ).toBeVisible();
    await expect(
      page.getByRole("dialog").locator("input[type='file']"),
    ).toHaveCount(0);
  } finally {
    await db.end();
  }
});
