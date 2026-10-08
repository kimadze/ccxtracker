import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { Client } from "pg";

test("compact overview supports funded positions, privacy and responsive layouts", async ({
  page,
}, info) => {
  test.setTimeout(600000);
  page.setDefaultTimeout(10000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const cookies = JSON.parse(await readFile(".local/e2e-cookies.json", "utf8"));
  await page.context().addCookies([
    {
      name: "better-auth.session_token",
      value: cookies["alice-" + info.project.name],
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto("/portfolios");
  await page
    .getByRole("button", { name: "პორტფელის შექმნა", exact: true })
    .first()
    .click();
  const dialog = page.locator("dialog[open]");
  await dialog
    .getByLabel("პორტფელის სახელი")
    .fill("მიმოხილვის სატესტო პორტფელი");
  await dialog
    .getByRole("button", { name: "პორტფელის შექმნა", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "პორტფელის მიმოხილვა" }),
  ).toBeAttached();
  await expect(page).toHaveURL(/\/portfolios\/[0-9a-f-]+$/);
  const base = page.url();
  await page.screenshot({
    path: ".local/overview-empty-" + info.project.name + ".png",
    fullPage: true,
  });
  for (const kind of ["შეტანა", "შესყიდვა"]) {
    await page
      .getByRole("button", { name: "ტრანზაქციის დამატება", exact: true })
      .click();
    await dialog
      .getByLabel("ტრანზაქციის ტიპი")
      .selectOption(kind === "შეტანა" ? "cash-deposit" : "buy");
    await dialog
      .getByLabel("აქტივი", { exact: true })
      .selectOption(kind === "შეტანა" ? "USD" : "bitcoin");
    await dialog
      .getByLabel(kind === "შეტანა" ? "თანხა (USD)" : "რაოდენობა", {
        exact: true,
      })
      .fill(kind === "შეტანა" ? "10000" : "0.1");
    if (kind === "შესყიდვა")
      await dialog
        .getByLabel("ერთეულის ფასი (USD)", { exact: true })
        .fill("50000");
    await dialog.getByRole("button", { name: "შენახვა", exact: true }).click();
    await expect(dialog).toHaveCount(0);
  }
  const db = new Client({
    connectionString: "postgresql://postgres:postgres@127.0.0.1:55439/postgres",
  });
  await db.connect();
  try {
    await db.query(
      "INSERT INTO market_quotes (asset_id, price, quoted_at) VALUES ('bitcoin', 3000, now()) ON CONFLICT (asset_id) DO UPDATE SET price=3000, quoted_at=now(), fetched_at=now()",
    );
    for (let i = 0; i < 5; i++) {
      const asset = `overview-test-${i}`;
      await db.query(
        "INSERT INTO assets (id, symbol, name, provider_id) VALUES ($1,$2,$3,$1) ON CONFLICT DO NOTHING",
        [asset, `TST${i}`, "განსაკუთრებით გრძელი აქტივის სატესტო დასახელება"],
      );
      await db.query(
        "INSERT INTO transactions (id, portfolio_id, asset_id, kind, quantity, price, occurred_at, sequence) VALUES (gen_random_uuid(),$1,$2,'buy',10,1,now(),$3)",
        [new URL(base).pathname.split("/")[2], asset, i + 100],
      );
      await db.query(
        "INSERT INTO market_quotes (asset_id, price, quoted_at) VALUES ($1,0.00000443,now()) ON CONFLICT (asset_id) DO UPDATE SET quoted_at=now()",
        [asset],
      );
    }
    await db.query(
      "INSERT INTO watchlist_items (portfolio_id,asset_id,entry_price,notes) VALUES ($1,'bitcoin',2500,'სატესტო შენიშვნა')",
      [new URL(base).pathname.split("/")[2]],
    );
    await db.query(
      "INSERT INTO transactions (id, portfolio_id, asset_id, kind, quantity, price, occurred_at, sequence,airdrop_source,airdrop_network,airdrop_status) VALUES (gen_random_uuid(),$1,'bitcoin','airdrop',0.001,3000,now(),500,'სატესტო პროექტი','Bitcoin','received')",
      [new URL(base).pathname.split("/")[2]],
    );
    for (let i = 1; i <= 10; i++) {
      const day = new Date(Date.now() - i * 86400000);
      await db.query(
        "INSERT INTO portfolio_snapshots (portfolio_id, day, captured_at, value, cash, revision) VALUES ($1,$2,$3,$4,5000,0) ON CONFLICT DO NOTHING",
        [
          new URL(base).pathname.split("/")[2],
          day.toISOString().slice(0, 10),
          day,
          String(5300 + i * 400),
        ],
      );
    }
  } finally {
    await db.end();
  }
  for (const width of [360, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "პორტფელის მიმოხილვა" }),
    ).toBeAttached();
    if (width === 390) {
      const assets = await page
        .getByRole("heading", { name: "აქტივები", exact: true })
        .boundingBox();
      expect(assets!.y + assets!.height).toBeLessThan(760);
      await expect(
        page.getByRole("button", { name: "ტრანზაქციის დამატება", exact: true }),
      ).not.toBeVisible();
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await expect(
      page.locator('a[href$="/positions/bitcoin"]:visible'),
    ).toBeVisible();
    await page.screenshot({
      path: ".local/compact-" + info.project.name + "-" + width + ".png",
      fullPage: true,
    });
  }
  const sidebar = page.getByRole("complementary", { name: "გვერდითი მენიუ" });
  await expect(sidebar).toHaveCSS("width", "224px");
  await expect(page.locator("#ccx-main-drawer")).toBeChecked();
  await expect(sidebar).toHaveCSS("width", "224px");
  await expect(
    page.getByRole("button", { name: "მენიუს შეკუმშვა" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "მენიუს შეკუმშვა" }).click();
  await expect(
    page.getByRole("button", { name: "მენიუს გაშლა" }),
  ).toHaveAttribute("aria-expanded", "false");
  await expect(sidebar).toHaveCSS("width", "64px");
  await expect(sidebar.locator(".menu-title").first()).toBeHidden();
  expect(await sidebar.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: ".local/compact-menu-" + info.project.name + ".png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "მენიუს გაშლა" }).click();
  await expect(sidebar).toHaveCSS("width", "224px");
  await page.getByRole("button", { name: "თანხების დამალვა" }).click();
  await expect(page.locator(".balance-value").first()).toContainText("••••••");
  await page.getByRole("button", { name: "თანხების ჩვენება" }).click();
  await expect(page.locator(".balance-value").first()).not.toContainText(
    "••••••",
  );
  await page.locator('a[href$="/positions/bitcoin"]:visible').click();
  await expect(page).toHaveURL(/positions\/bitcoin$/);
  await page.goto(base);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(
    page.getByRole("navigation", { name: "მობილური ნავიგაცია" }),
  ).toBeVisible();
  await page
    .getByText("ლიკვიდობა", { exact: true })
    .filter({ visible: true })
    .click();
  await expect(
    page.getByText("ნაღდი ფული", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "დამატება", exact: true }).click();
  await expect(page.locator("dialog[open]")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  const routes = [
    "positions",
    "transactions",
    "airdrops",
    "analytics",
    "statistics?tab=market",
    "statistics?tab=macro",
    "statistics?tab=portfolio",
    "watchlist",
    "allocation",
    "strategy",
    "scenarios",
    "journal",
    "settings",
    "positions/bitcoin?tab=overview",
    "positions/bitcoin?tab=transactions",
    "positions/bitcoin?tab=plan",
    "positions/bitcoin?tab=journal",
  ];
  for (const width of [1024, 360, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of routes) {
      await page.goto(base + "/" + route);
      await expect(page.locator("main#main")).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toBeAttached();
      if (route === "positions" && width === 1024) {
        await expect(
          page.getByRole("columnheader", { name: "ღირებულება", exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole("columnheader", {
            name: "მოგება / ზარალი",
            exact: true,
          }),
        ).toBeVisible();
        expect(
          await page
            .locator("main table")
            .evaluate(
              (table) =>
                table.getBoundingClientRect().width <=
                table.parentElement!.clientWidth + 1,
            ),
        ).toBe(true);
      }
      const fits = await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      );
      if (!fits)
        console.log(
          route,
          width,
          await page.evaluate(() =>
            [...document.querySelectorAll("main *")]
              .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
              .slice(0, 12)
              .map((el) => ({
                tag: el.tagName,
                cls: el.className,
                width: el.getBoundingClientRect().width,
              })),
          ),
        );
      await page.screenshot({
        path: `.local/audit-${route.replace(/[^a-z]/g, "-")}-${width}.png`,
        fullPage: true,
      });
      expect(fits, `${route} at ${width}`).toBe(true);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "/positions/bitcoin?tab=exit");
  await expect(
    page.getByRole("tab", { name: "გეგმა", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("heading", { name: "გაყიდვის ეტაპები" }),
  ).toBeVisible();
  await page
    .getByRole("tab", { name: "გეგმა", exact: true })
    .press("ArrowRight");
  await expect(page).toHaveURL(/tab=journal/);
  await page
    .getByLabel("საინვესტიციო თეზისი", { exact: true })
    .fill("მობილურიდან შენახული სატესტო თეზისი");
  await page.getByRole("button", { name: "ჟურნალის შენახვა" }).click();
  await expect(page.getByRole("status")).toContainText("ჟურნალი შენახულია");
  await page.reload();
  await expect(
    page.getByLabel("საინვესტიციო თეზისი", { exact: true }),
  ).toHaveValue("მობილურიდან შენახული სატესტო თეზისი");
  await page.goto(base + "/statistics?tab=macro");
  await page
    .getByRole("tab", { name: "მაკრო", exact: true })
    .press("ArrowRight");
  await expect(page).toHaveURL(/tab=portfolio/);
  await page.goto(base + "/positions");
  await page.getByRole("button", { name: "ფილტრი", exact: false }).click();
  const positionFilters = page.getByRole("dialog", {
    name: "პოზიციების ფილტრი",
  });
  await expect(positionFilters).toBeVisible();
  const losingFilter = positionFilters.getByRole("button", {
    name: /^ზარალში/,
  });
  await losingFilter.click();
  await expect(losingFilter).toHaveAttribute("aria-pressed", "true");
  await expect(positionFilters.locator(".modal-box")).toHaveCSS(
    "overflow-y",
    "auto",
  );
  await page.keyboard.press("Escape");
  await expect(positionFilters).not.toBeVisible();
  await page.goto(base + "/positions/bitcoin");
  await page.getByRole("button", { name: "გაზიარება", exact: true }).click();
  for (const name of ["კლასიკური", "რეაქცია", "პერსონაჟი"]) {
    await page.getByRole("tab", { name, exact: true }).click();
    await expect(
      page.getByRole("button", { name: "PNG", exact: true }),
    ).toBeEnabled({ timeout: 25000 });
    await page.getByRole("tab", { name, exact: true }).click();
    await expect(
      page.getByRole("button", { name: "PNG", exact: true }),
    ).toBeEnabled();
    expect(
      await page
        .locator("canvas")
        .evaluate(
          (canvas: HTMLCanvasElement) => canvas.width > 0 && canvas.height > 0,
        ),
    ).toBe(true);
    await page.screenshot({ path: `.local/share-${name}.png`, fullPage: true });
  }
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "PNG", exact: true }).click();
  expect((await downloadPromise).suggestedFilename()).toMatch(/\.png$/);
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    if (width === 390) await page.goto(base + "/transactions?new=1");
    else {
      await page.goto(base + "/transactions");
      await page
        .getByRole("button", { name: "ტრანზაქციის დამატება", exact: true })
        .click();
    }
    const form = page.getByRole("dialog", {
      name: "ტრანზაქციის დამატება",
      exact: true,
    });
    for (const kind of [
      "buy",
      "sell",
      "cash-deposit",
      "asset-deposit",
      "withdrawal",
      "fee",
      "airdrop",
    ]) {
      await form.getByLabel("ტრანზაქციის ტიპი").selectOption(kind);
      await expect(form.getByLabel("აქტივი", { exact: true })).toBeVisible();
      if (width === 390) {
        const quantity = form.getByLabel(/^(რაოდენობა|თანხა \(USD\))$/);
        await quantity.focus();
        await expect(quantity).toBeFocused();
        await quantity.scrollIntoViewIfNeeded();
        const save = form.getByRole("button", { name: "შენახვა", exact: true });
        await save.scrollIntoViewIfNeeded();
        const saveBounds = await save.boundingBox();
        expect(saveBounds!.y + saveBounds!.height).toBeLessThanOrEqual(844);
      }
      expect(
        await form.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
      await page.screenshot({
        path: `.local/form-${kind}-${width}.png`,
        fullPage: true,
      });
    }
    await page.keyboard.press("Escape");
    await expect(form).not.toBeVisible();
  }
});
