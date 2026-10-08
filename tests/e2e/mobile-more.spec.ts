import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("More sheet has readable touch rows outside the dock at narrow and short viewports", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile", "Touch navigation regression");
  test.setTimeout(120000);
  page.setDefaultTimeout(10000);
  const cookies = JSON.parse(await readFile(".local/e2e-cookies.json", "utf8"));
  await page.context().addCookies([
    {
      name: "better-auth.session_token",
      value: cookies["alice-mobile"],
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto("/portfolios");
  await page
    .getByRole("button", { name: "პორტფელის შექმნა", exact: true })
    .first()
    .tap();
  const create = page.getByRole("dialog", {
    name: "ახალი პორტფელი",
    exact: true,
  });
  await create
    .getByLabel("პორტფელის სახელი")
    .fill("მობილურის მენიუს შემოწმება");
  await create
    .getByRole("button", { name: "პორტფელის შექმნა", exact: true })
    .tap();
  await expect(page).toHaveURL(/\/portfolios\/[0-9a-f-]+$/);
  const base = page.url();
  const more = page.getByRole("button", { name: "მეტი გვერდი", exact: true });
  const sheet = page.getByRole("dialog", {
    name: "ყველა ხელსაწყო",
    exact: true,
  });

  for (const [width, height] of [
    [360, 800],
    [390, 844],
    [430, 932],
    [768, 900],
    [390, 420],
  ]) {
    await page.setViewportSize({ width, height });
    await more.tap();
    await expect(sheet).toBeVisible();
    await expect(page.locator(".dock > dialog")).toHaveCount(0);
    await expect(sheet.getByRole("link")).toHaveCount(8);
    await expect
      .poll(async () =>
        sheet
          .locator(".modal-box")
          .evaluate((box) => box.getBoundingClientRect().bottom),
      )
      .toBeLessThanOrEqual(height + 1);
    const geometry = await sheet.locator(".modal-box").evaluate((box) => {
      const rect = box.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        overflow: box.scrollWidth > box.clientWidth + 1,
      };
    });
    expect(geometry.width).toBeGreaterThanOrEqual(Math.min(width, 576) - 2);
    expect(geometry.height).toBeLessThanOrEqual(height * 0.85 + 1);
    expect(geometry.left).toBeGreaterThanOrEqual(-1);
    expect(geometry.right).toBeLessThanOrEqual(width + 1);
    expect(geometry.bottom).toBeLessThanOrEqual(height + 1);
    expect(geometry.overflow).toBe(false);
    for (const link of await sheet.getByRole("link").all()) {
      const bounds = await link.boundingBox();
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
      expect(
        await link.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
    }
    await sheet
      .getByRole("link", { name: "პარამეტრები", exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: `.local/more-menu-${width}-${height}.png` });
    await sheet
      .getByRole("button", { name: "დახურვა", exact: true })
      .first()
      .tap();
    await expect(sheet).not.toBeVisible();
    await expect(more).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await more.tap();
  await sheet.getByRole("link", { name: "ტრანზაქციები", exact: true }).tap();
  await expect(page).toHaveURL(base + "/transactions");
  await expect(sheet).not.toBeVisible();
  await more.tap();
  await page.keyboard.press("Escape");
  await expect(sheet).not.toBeVisible();
  await expect(more).toBeFocused();
});
