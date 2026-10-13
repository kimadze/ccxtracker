import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("admin sections fit responsive sizes, preserve AI controls and deny other users", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const cookies = JSON.parse(await readFile(".local/e2e-cookies.json", "utf8"));
  const owner = `alice-${info.project.name}`;
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
