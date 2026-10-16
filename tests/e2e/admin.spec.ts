import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
test("admin sections fit responsive sizes, preserve AI controls and deny other users", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const cookies = JSON.parse(await readFile(".local/e2e-cookies.json", "utf8"));
  const owner = `alice-${info.project.name}`;
  const db = new Client({
    connectionString: "postgresql://postgres:postgres@127.0.0.1:55439/postgres",
  });
  await db.connect();
  try {
    for (const [index, error] of [
      null,
      "BOT_BLOCKED",
      "TELEGRAM_429",
      "CANCELLED",
      "EXPIRED",
      "DELIVERY_FAILED",
      null,
    ].entries()) {
      await db.query(
        "INSERT INTO telegram_digests(user_id,generation,day,portfolio_ids,attempts,last_error,sent_at) VALUES ($1,gen_random_uuid(),$2,'[]',1,$3,$4)",
        [
          owner,
          `2026-10-${String(index + 1).padStart(2, "0")}`,
          error,
          index === 0 ? new Date() : null,
        ],
      );
    }
  } finally {
    await db.end();
  }
  await page.context().addCookies([
    {
      name: "better-auth.session_token",
      value: cookies[owner],
      domain: "localhost",
      path: "/",
    },
  ]);
  for (const width of [360, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const tab of ["system", "notifications", "ai", "users", "history"]) {
      await page.goto(`/admin?tab=${tab}`);
      await expect(
        page.getByRole("heading", { name: "ადმინისტრირება", exact: true }),
      ).toBeVisible();
      if (tab === "notifications") {
        await expect(
          page.getByText("ბოტი დაბლოკილია", { exact: true }).first(),
        ).toBeVisible();
        await expect(
          page.getByText("გაგზავნილია", { exact: true }).first(),
        ).toHaveClass(/badge-success/);
        await expect(
          page.getByText("ხელახალი ცდა დაგეგმილია", { exact: true }).first(),
        ).toHaveClass(/badge-dash/);
        await expect(page.getByText("EXPIRED", { exact: true })).toHaveCount(0);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
      if ([390, 1440].includes(width))
        await page.screenshot({
          path: info.outputPath(`admin-${tab}-${width}.png`),
          fullPage: true,
        });
    }
  }
  await page.goto("/admin?tab=ai");
  const enabled = page.getByRole("checkbox", {
    name: "ტექსტისა და სქრინშოტის დამუშავება",
  });
  await enabled.uncheck();
  await page
    .getByRole("spinbutton", {
      name: "მოთხოვნები / მომხმარებელი / 24სთ",
      exact: true,
    })
    .fill("5");
  await page.getByRole("button", { name: "შენახვა", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("პარამეტრები შენახულია");
  await page.reload();
  await expect(enabled).not.toBeChecked();
  await expect(
    page.getByRole("spinbutton", {
      name: "მოთხოვნები / მომხმარებელი / 24სთ",
      exact: true,
    }),
  ).toHaveValue("5");
  await enabled.check();
  await page
    .getByRole("spinbutton", {
      name: "მოთხოვნები / მომხმარებელი / 24სთ",
      exact: true,
    })
    .fill("20");
  await page.getByRole("button", { name: "შენახვა", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("პარამეტრები შენახულია");
  await page.context().clearCookies();
  await page.context().addCookies([
    {
      name: "better-auth.session_token",
      value: cookies.bob,
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto("/admin");
  await expect(
    page.getByText("გვერდი ვერ მოიძებნა", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "ადმინისტრირება", exact: true }),
  ).toHaveCount(0);
});
