import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
test("Telegram private link, confirmation, choices and disconnect fit all sizes", async ({
  page,
}, info) => {
  test.skip(
    process.env.CCX_E2E_TELEGRAM_FIXTURES !== "1",
    "Requires isolated Telegram transport fixture",
  );
  test.setTimeout(120000);
  const cookies = JSON.parse(await readFile(".local/e2e-cookies.json", "utf8")),
    user = `alice-${info.project.name}`,
    pid = randomUUID();
  await page
    .context()
    .addCookies([
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
      "Telegram პორტფელი გრძელი ქართული სახელით",
    ]);
    await page.goto(`/portfolios/${pid}/settings`);
    const section = page.locator(
      "section[aria-labelledby='settings-telegram']",
    );
    await section
      .getByRole("button", { name: "Telegram-ის დაკავშირება", exact: true })
      .click();
    const href = await section
        .getByRole("link", { name: "Telegram-ის გახსნა", exact: true })
        .getAttribute("href"),
      token = new URL(href!).searchParams.get("start");
    expect(href).toContain("https://t.me/CCXTRACKER_BOT?start=");
    const chat = info.project.name === "desktop" ? 123456 : 234567;
    const reply = await page.request.post("/api/telegram/webhook", {
      headers: {
        "x-telegram-bot-api-secret-token":
          "e2e-only-telegram-webhook-secret-123456",
      },
      data: {
        message: {
          text: `/start ${token}`,
          chat: { id: chat, type: "private" },
          from: { id: chat, is_bot: false, username: "ccx_test_owner" },
        },
      },
    });
    expect(reply.status()).toBe(200);
    await section
      .getByRole("button", { name: "კავშირის შემოწმება", exact: true })
      .click();
    await expect(section).toContainText("@ccx_test_owner");
    await section
      .getByRole("button", { name: "ჩატის დადასტურება", exact: true })
      .click();
    await expect(section).toContainText("დაკავშირებულია");
    await section.getByLabel("შესყიდვა", { exact: true }).uncheck();
    await section
      .getByRole("button", { name: "არჩევანის შენახვა", exact: true })
      .click();
    await expect(section).toContainText("შეტყობინებების არჩევანი შენახულია.");
    expect(
      (
        await db.query(
          "SELECT buy_enabled,sell_enabled FROM telegram_connections WHERE user_id=$1",
          [user],
        )
      ).rows[0],
    ).toEqual({ buy_enabled: false, sell_enabled: true });
    await section
      .getByRole("button", { name: "სატესტო შეტყობინება", exact: true })
      .click();
    await expect(section).toContainText("სატესტო შეტყობინება გაიგზავნა.");
    for (const width of [360, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await section.scrollIntoViewIfNeeded();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `.local/telegram-settings-${width}-${info.project.name}.png`,
      });
    }
    await section.getByRole("button", { name: "გათიშვა", exact: true }).click();
    await expect(section).toContainText("Telegram გათიშულია.");
    expect(
      (
        await db.query("SELECT * FROM telegram_connections WHERE user_id=$1", [
          user,
        ])
      ).rows,
    ).toHaveLength(0);
  } finally {
    await db.end();
  }
});
