import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("button hierarchy preserves selection, touch targets and form actions", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const cookies = JSON.parse(await readFile(".local/e2e-cookies.json", "utf8"));
  await page.context().addCookies([
    {
      name: "better-auth.session_token",
      value: cookies["alice-" + info.project.name],
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/portfolios");
  await page
    .getByRole("button", { name: "პორტფელის შექმნა", exact: true })
    .first()
    .click();
  const create = page.locator("dialog[open]");
  await create.getByLabel("პორტფელის სახელი").fill("ღილაკების შემოწმება");
  await create
    .getByRole("button", { name: "პორტფელის შექმნა", exact: true })
    .click();
  await expect(page).toHaveURL(/\/portfolios\/[0-9a-f-]+$/, { timeout: 15000 });
  const base = page.url();
  await expect(
    page.getByRole("button", { name: "მენიუს შეკუმშვა", exact: true }),
  ).toBeVisible();
  const sidebar = page.getByRole("complementary", { name: "გვერდითი მენიუ" });
  await expect(sidebar).toBeVisible();
  await expect.poll(async () => (await sidebar.boundingBox())!.width).toBe(224);
  const assertCenteredIcons = async () => {
    const offsets = await sidebar
      .locator("a[aria-label]:has(svg)")
      .evaluateAll((links) =>
        links.map((link) => {
          const row = link.getBoundingClientRect();
          const icon = link.querySelector("svg")!.getBoundingClientRect();
          return Math.abs(icon.y + icon.height / 2 - row.y - row.height / 2);
        }),
      );
    expect(offsets.length).toBeGreaterThan(0);
    for (const offset of offsets) expect(offset).toBeLessThanOrEqual(1);
  };
  await assertCenteredIcons();
  await page
    .getByRole("button", { name: "მენიუს შეკუმშვა", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "მენიუს გაშლა", exact: true }),
  ).toBeVisible();
  await expect.poll(async () => (await sidebar.boundingBox())!.width).toBe(64);
  await assertCenteredIcons();
  await page.getByRole("button", { name: "მენიუს გაშლა", exact: true }).click();
  expect(
    await sidebar
      .getByRole("list", { name: "მთავარი ნავიგაცია" })
      .evaluate((el) => getComputedStyle(el).flexWrap),
  ).toBe("nowrap");
  await expect(
    sidebar.getByRole("button", { name: "გასვლა", exact: true }),
  ).toBeInViewport();
  await page.setViewportSize({ width: 1440, height: 650 });
  const navigation = sidebar.getByRole("list", { name: "მთავარი ნავიგაცია" });
  expect(
    await navigation.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  await sidebar
    .getByRole("link", { name: "პარამეტრები", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    sidebar.getByRole("button", { name: "გასვლა", exact: true }),
  ).toBeInViewport();
  await page.screenshot({
    path: ".local/buttons-sidebar-650.png",
    fullPage: true,
  });
  for (const width of [360, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(base + "/transactions?new=1");
    const form = page.getByRole("dialog", {
      name: "ტრანზაქციის დამატება",
      exact: true,
    });
    await expect(form).toBeVisible();
    const deposit = form.getByLabel("ტრანზაქციის ტიპი");
    await deposit.selectOption("cash-deposit");
    await expect(deposit).toHaveValue("cash-deposit");
    const save = form.getByRole("button", { name: "შენახვა", exact: true });
    const cancel = form.getByRole("button", { name: "გაუქმება", exact: true });
    await save.scrollIntoViewIfNeeded();
    for (const control of [deposit, save, cancel]) {
      const bounds = await control.boundingBox();
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
    }
    await save.press("Shift+Tab");
    await expect(cancel).toBeFocused();
    expect(
      await cancel.evaluate((el) => getComputedStyle(el).outlineStyle),
    ).not.toBe("none");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.local/buttons-form-${width}.png`,
      fullPage: true,
    });
    await cancel.click();
    await expect(form).not.toBeVisible();
    await page.goto(base + "/positions");
    await expect(
      page.getByRole("heading", { name: "პოზიციები", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.local/buttons-positions-${width}.png`,
      fullPage: true,
    });
    if (width >= 1024) {
      const cards = page.getByRole("button", { name: "ბარათების ხედი" });
      await cards.click();
      await expect(cards).toHaveAttribute("aria-pressed", "true");
      await expect(
        page.getByRole("button", { name: "ცხრილის ხედი" }),
      ).toHaveAttribute("aria-pressed", "false");
    } else {
      await page.getByRole("button", { name: "ფილტრი", exact: false }).click();
      const filter = page.getByRole("dialog", { name: "პოზიციების ფილტრი" });
      const loss = filter.getByRole("button", { name: /^ზარალში/ });
      await loss.click();
      await expect(loss).toHaveAttribute("aria-pressed", "true");
      await page.screenshot({
        path: `.local/buttons-filter-${width}.png`,
        fullPage: true,
      });
      await page.keyboard.press("Escape");
      await expect(filter).not.toBeVisible();
    }
  }
});
