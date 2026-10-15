import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

test("reference overview keeps responsive financial hierarchy, search, privacy and real navigation", async ({
  page,
}, info) => {
  test.setTimeout(240000);
  const user = `alice-${info.project.name}`,
    pid = randomUUID();
  const cookies = JSON.parse(await readFile(".local/e2e-cookies.json", "utf8"));
  await page.context().addCookies([
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
      "კრიპტო კოლექტივი · სატესტო",
    ]);
    const assets = [
      ["bitcoin", "BTC", "Bitcoin", "0.1", "50000", "60000", false],
      ["ethereum", "ETH", "Ethereum", "1", "2000", "2500", false],
      ["stellar", "XLM", "Stellar", "1000", "0.1", "0.12", false],
      ["starknet", "STRK", "Starknet", "200", "0.5", "0.75", false],
      ["tether", "USDT", "Tether", "500", "1", "1", true],
      [
        "overview-tiny",
        "TINY",
        "განსაკუთრებით გრძელი ქართული აქტივის დასახელება",
        "2",
        "0.01",
        "0.00000012",
        false,
      ],
    ] as const;
    await db.query(
      "INSERT INTO transactions(id,portfolio_id,asset_id,kind,quantity,occurred_at,sequence) VALUES(gen_random_uuid(),$1,'USD','deposit',10000,now()-interval '32 days',1)",
      [pid],
    );
    for (const [
      i,
      [id, symbol, name, q, price, current, stable],
    ] of assets.entries()) {
      await db.query(
        "INSERT INTO assets(id,symbol,name,provider_id,is_stablecoin) VALUES($1,$2,$3,$1,$4) ON CONFLICT(id) DO UPDATE SET is_stablecoin=excluded.is_stablecoin",
        [id, symbol, name, stable],
      );
      await db.query(
        "INSERT INTO transactions(id,portfolio_id,asset_id,kind,quantity,price,occurred_at,sequence) VALUES(gen_random_uuid(),$1,$2,'buy',$3,$4,now()-interval '31 days',$5)",
        [pid, id, q, price, i + 2],
      );
      await db.query(
        "INSERT INTO market_quotes(asset_id,price,quoted_at) VALUES($1,$2,now()) ON CONFLICT(asset_id) DO UPDATE SET price=excluded.price,quoted_at=now(),fetched_at=now()",
        [id, current],
      );
    }
    for (let i = 0; i < 30; i++)
      await db.query(
        "INSERT INTO portfolio_snapshots(portfolio_id,day,captured_at,value,cash,revision) VALUES($1,current_date-$2::integer,now()-($2||' days')::interval,$3,2299.98,0)",
        [pid, 29 - i, String(8000 + i * 120)],
      );
    const base = `/portfolios/${pid}`;
    for (const width of [360, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
      await page.goto(base);
      await expect(page.locator("body")).toHaveCSS(
        "background-color",
        "rgb(14, 15, 18)",
      );
      await expect(
        page.getByRole("heading", { name: "პორტფელის მიმოხილვა" }),
      ).toBeAttached();
      await expect(page.locator(".recharts-area")).toBeVisible();
      await expect
        .poll(() =>
          page
            .locator('[role="img"][aria-label="პორტფელის ღირებულების ისტორია"]')
            .evaluate((element) => {
              const svg = element.querySelector("svg");
              return (
                !!svg &&
                Math.abs(
                  svg.getBoundingClientRect().width - element.clientWidth,
                ) <= 1
              );
            }),
        )
        .toBe(true);
      await page.getByRole("button", { name: "7D", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "7D", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      const search = page.getByRole("textbox", {
        name: "აქტივის ძიება",
        exact: true,
      });
      await search.fill("XLM");
      const section = page.getByRole("region", { name: "პორტფელის აქტივები" });
      await expect(section.locator("table tbody tr")).toHaveCount(1);
      await expect(section.locator("table")).toContainText("XLM");
      await search.fill("");
      await expect(section.locator("table tbody tr")).toHaveCount(6);
      const tabs = page.getByRole("tablist", { name: "პორტფელის სექციები" });
      await tabs.getByRole("tab", { name: "პოზიციები", exact: true }).click();
      await expect(page.getByRole("tabpanel")).toContainText("შედეგი");
      await expect(
        page.getByRole("textbox", { name: "პოზიციების ძიება", exact: true }),
      ).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`${base}$`));
      await expect(page.locator(".recharts-area")).toBeVisible();
      await tabs
        .getByRole("tab", { name: "პოზიციები", exact: true })
        .press("ArrowRight");
      await expect(
        tabs.getByRole("tab", { name: "ტრანზაქციები", exact: true }),
      ).toHaveAttribute("aria-selected", "true");
      await expect(page).toHaveURL(new RegExp(`${base}$`));
      await expect(page.getByRole("tabpanel")).toContainText("BTC");
      await expect(
        page.getByRole("textbox", { name: "ტრანზაქციების ძიება", exact: true }),
      ).toBeVisible();
      if ([390, 1440].includes(width))
        await page.screenshot({
          path: `.local/overview-transactions-${info.project.name}-${width}.png`,
          fullPage: true,
        });
      await tabs
        .getByRole("tab", { name: "ტრანზაქციები", exact: true })
        .press("Home");
      await expect(
        tabs.getByRole("tab", { name: "აქტივები", exact: true }),
      ).toHaveAttribute("aria-selected", "true");
      await expect(section.locator("table tbody tr")).toHaveCount(6);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      if (width === 390) {
        const assets = await page
          .getByRole("heading", { name: "აქტივები", exact: true })
          .boundingBox();
        expect(assets!.y + assets!.height).toBeLessThan(760);
        await page
          .getByText("ლიკვიდობა", { exact: true })
          .filter({ visible: true })
          .click();
        await expect(
          page
            .getByText("ნაღდი ფული", { exact: true })
            .filter({ visible: true }),
        ).toBeVisible();
        await page
          .getByText("ლიკვიდობა", { exact: true })
          .filter({ visible: true })
          .click();
      }
      await page.screenshot({
        path: `.local/reference-overview-${info.project.name}-${width}.png`,
        fullPage: true,
      });
    }
    await page
      .getByRole("button", { name: "თანხების დამალვა", exact: true })
      .click();
    await expect(page.locator(".balance-value").first()).toContainText(
      "••••••",
    );
    await page
      .getByRole("button", { name: "თანხების ჩვენება", exact: true })
      .click();
    await page
      .getByRole("link", { name: "BTC გაყიდვის გეგმა", exact: true })
      .click();
    await expect(page).toHaveURL(/positions\/bitcoin\?tab=plan$/);
    await page.goto(base);
    await page
      .getByRole("button", { name: "ტრანზაქციის დამატება", exact: true })
      .click();
    await expect(page.locator("dialog[open]")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await db.query("DELETE FROM market_quotes WHERE asset_id='overview-tiny'");
    await page.reload();
    await expect(
      page.getByRole("status").filter({ hasText: "ჯამი არასრულია" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  } finally {
    await db.end();
  }
});
