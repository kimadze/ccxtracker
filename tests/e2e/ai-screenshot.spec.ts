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
    const pasteArea = dialog.getByRole("textbox", {
      name: "სურათის ჩასმის არე",
    });
    const preview = dialog.getByAltText("არჩეული ტრანზაქციის სქრინშოტი");
    let requests = 0;
    page.on("request", (request) => {
      if (request.url().includes("/api/ai/transaction-screenshot")) requests++;
    });
    const paste = async (count = 1, type = "image/png", size = 0) => {
      await pasteArea.focus();
      await pasteArea.evaluate(
        (element, payload) => {
          const clipboardData = new DataTransfer();
          const bytes = Uint8Array.from(atob(payload.base64), (c) =>
            c.charCodeAt(0),
          );
          for (let i = 0; i < payload.count; i++) {
            clipboardData.items.add(
              new File(
                [payload.size ? new Uint8Array(payload.size) : bytes],
                `paste-${i}.png`,
                { type: payload.type },
              ),
            );
          }
          element.dispatchEvent(
            new ClipboardEvent("paste", {
              clipboardData,
              bubbles: true,
              cancelable: true,
            }),
          );
        },
        { count, type, size, base64: png.toString("base64") },
      );
    };
    const original = await preview.getAttribute("src");
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"], {
        origin: "http://localhost:3100",
      });
    await page.evaluate(async (base64) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": new Blob([bytes], { type: "image/png" }),
        }),
      ]);
    }, png.toString("base64"));
    await pasteArea.press("Control+v");
    await expect(preview).not.toHaveAttribute("src", original!);
    await expect(pasteArea).toHaveValue("");
    await page.evaluate(async () =>
      navigator.clipboard.writeText("ordinary text"),
    );
    await pasteArea.press("Control+v");
    await expect(pasteArea).toHaveValue("");
    await expect(preview).not.toHaveAttribute("src", original!);
    const pasted = await preview.getAttribute("src");
    await paste(2);
    await expect(dialog.getByText("ჩასვი მხოლოდ ერთი სურათი.")).toBeVisible();
    await expect(preview).toHaveAttribute("src", pasted!);
    await paste(1, "image/gif");
    await expect(
      dialog.getByText("აირჩიე PNG, JPEG ან WebP სურათი, მაქსიმუმ 5MB."),
    ).toBeVisible();
    await expect(preview).toHaveAttribute("src", pasted!);
    await paste(1, "image/png", 5 * 1024 * 1024 + 1);
    await expect(preview).toHaveAttribute("src", pasted!);
    const description = dialog.getByRole("textbox", {
      name: "ტრანზაქციის აღწერა",
    });
    await description.press("Control+v");
    await expect(description).toHaveValue("ordinary text");
    await description.evaluate((element) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData("text/plain", "ordinary text");
      const event = new ClipboardEvent("paste", {
        clipboardData,
        bubbles: true,
        cancelable: true,
      });
      element.dispatchEvent(event);
      if (event.defaultPrevented) throw new Error("Text paste intercepted");
    });
    await expect(preview).toHaveAttribute("src", pasted!);
    expect(requests).toBe(0);
    await paste();
    await page.route(
      "**/api/ai/transaction-screenshot",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, error: "ორდერი არ შესრულებულა." }),
        });
      },
      { times: 1 },
    );
    await dialog
      .getByRole("button", { name: "ამოკითხვა", exact: true })
      .click();
    await expect(dialog.getByText("ორდერი არ შესრულებულა.")).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "ფორმაში გადატანა" }),
    ).toHaveCount(0);
    await dialog
      .getByRole("button", { name: "ამოკითხვა", exact: true })
      .click();
    const confirm = dialog.getByRole("button", {
      name: "მონახაზის დადასტურება",
    });
    await expect(confirm).toBeVisible();
    await expect(confirm).toBeDisabled();
    await expect(
      dialog.getByRole("button", { name: "ფორმაში გადატანა" }),
    ).toHaveCount(0);
    await expect(dialog.getByLabel("საკომისიო — სურვილისამებრ")).toHaveValue(
      "",
    );
    await dialog
      .getByLabel("ტრანზაქციის თარიღი (შენი დროით)")
      .fill("2026-10-12");
    await dialog
      .getByRole("region", { name: "სქრინშოტიდან შევსება" })
      .getByLabel("1 USDT = USD")
      .fill("1");
    await expect(confirm).toBeDisabled();
    await dialog
      .getByRole("checkbox", {
        name: "გადავამოწმე შესრულებული რაოდენობა, ფასი, საკომისიო და თარიღი",
      })
      .check();
    await confirm.click();
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
    const settled = (
      await db.query(
        "SELECT settlement_asset_id, settlement_rate FROM transactions WHERE portfolio_id=$1 AND kind='sell'",
        [pid],
      )
    ).rows[0];
    expect(settled.settlement_asset_id).toBe("tether");
    expect(Number(settled.settlement_rate)).toBe(1);
    expect(
      Number(
        (
          await db.query(
            "SELECT quantity FROM positions WHERE portfolio_id=$1 AND asset_id='tether'",
            [pid],
          )
        ).rows[0].quantity,
      ),
    ).toBe(60);
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
