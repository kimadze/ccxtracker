import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

test("restored overview history supports periods, privacy and compact empty states", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const cookies = JSON.parse(await readFile(".local/e2e-cookies.json", "utf8"));
  const user = `alice-${info.project.name}`,
    pid = randomUUID();
  const db = new Client({
    connectionString: "postgresql://postgres:postgres@127.0.0.1:55439/postgres",
  });
  await db.connect();
  try {
    await db.query("INSERT INTO portfolios(id,user_id,name) VALUES($1,$2,$3)", [
      pid,
      user,
      "ისტორიის სატესტო პორტფელი",
    ]);
    await db.query(
      "INSERT INTO portfolio_snapshots(portfolio_id,day,captured_at,value,cash,revision) VALUES($1,current_date-2,now()-interval '2 days',100,100,0),($1,current_date-1,now()-interval '1 day',120,120,0),($1,current_date,now(),150,150,0)",
      [pid],
    );
    await page.context().addCookies([
      {
        name: "better-auth.session_token",
        value: cookies[user],
        domain: "localhost",
        path: "/",
      },
    ]);
    for (const width of [360, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`/portfolios/${pid}`);
      await expect(
        page.getByRole("img", {
          name: "პორტფელის ღირებულების ისტორია",
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.locator(".recharts-area")).toBeVisible();
      await page.getByRole("button", { name: "7D", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "7D", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if ([390, 1440].includes(width))
        await page.screenshot({
          path: info.outputPath(`history-${width}.png`),
          fullPage: true,
        });
    }
    await page
      .getByRole("button", { name: "თანხების დამალვა", exact: true })
      .click();
    await expect(page.getByText("••••", { exact: true }).first()).toBeVisible();
    await db.query(
      "DELETE FROM portfolio_snapshots WHERE portfolio_id=$1 AND day<current_date",
      [pid],
    );
    await page.reload();
    await expect(
      page.getByText("ხაზი გამოჩნდება მეორე შეფასების შენახვის შემდეგ.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", {
        name: "პორტფელის ღირებულების ისტორია",
        exact: true,
      }),
    ).toBeHidden();
    await db.query("DELETE FROM portfolio_snapshots WHERE portfolio_id=$1", [
      pid,
    ]);
    await page.reload();
    // An empty history automatically captures today's valuation and refreshes.
    // Assert the settled state rather than the transient zero-point message.
    await expect(
      page.getByText("ხაზი გამოჩნდება მეორე შეფასების შენახვის შემდეგ.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect
      .poll(async () => {
        const result = await db.query(
          "SELECT count(*)::int AS count FROM portfolio_snapshots WHERE portfolio_id=$1",
          [pid],
        );
        return result.rows[0].count;
      })
      .toBe(1);
  } finally {
    await db.end();
  }
});
