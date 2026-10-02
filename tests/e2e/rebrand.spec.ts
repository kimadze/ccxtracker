import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("empty workspace preserves all routes and responsive navigation", async ({
  page,
}, testInfo) => {
  test.setTimeout(600000);
  const cookies = JSON.parse(
    await readFile(".local/e2e-cookies.json", "utf8"),
  ) as Record<string, string>;
  await page.context().addCookies([
    {
      name: "better-auth.session_token",
      value: cookies["alice-" + testInfo.project.name],
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/portfolios");
  await page
    .getByRole("button", { name: "პორტფელის შექმნა", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("პორტფელის სახელი").fill("ცარიელი სატესტო პორტფელი");
  await dialog
    .getByRole("button", { name: "პორტფელის შექმნა", exact: true })
    .click();
  await expect(page).toHaveURL(/\/portfolios\/[^/]+$/);
  const base = new URL(page.url()).pathname;
  for (const width of [360, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of [
      "",
      "/positions",
      "/transactions",
      "/airdrops",
      "/analytics",
      "/statistics?tab=market",
      "/statistics?tab=macro",
      "/statistics?tab=portfolio",
      "/watchlist",
      "/allocation",
      "/strategy",
      "/scenarios",
      "/journal",
      "/settings",
    ]) {
      await page.goto(base + route);
      await expect(page.locator("main#main")).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toBeAttached();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `${route} ${width}`,
      ).toBe(true);
      await page.screenshot({
        path: `.local/empty-${route.replace(/[^a-z]/g, "-") || "overview"}-${width}.png`,
        fullPage: true,
      });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  await page
    .getByRole("navigation", { name: "მობილური ნავიგაცია" })
    .getByRole("button", { name: "მეტი გვერდი", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "ყველა ხელსაწყო" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "ყველა ხელსაწყო" }),
  ).not.toBeVisible();
  await page.goto(base + "/bubble-map");
  await expect(page).toHaveURL(/\/allocation$/);
  expect(errors).toEqual([]);
});
