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
      ["overview-extra", "EXTRA", "მეშვიდე აქტივი", "1", "1", "2", false],
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
        "INSERT INTO market_quotes(asset_id,price,change_24h,quoted_at) VALUES($1,$2,$3,now()) ON CONFLICT(asset_id) DO UPDATE SET price=excluded.price,change_24h=excluded.change_24h,quoted_at=now(),fetched_at=now()",
        [id, current, i === 0 ? "5.5" : i === 1 ? "-4.25" : "1"],
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
      const section = page.getByRole("region", { name: "პორტფელის აქტივები" });
      const assetList = section.getByTestId("overview-assets-list");
      await expect(assetList.locator("table tbody tr")).toHaveCount(6);
      await expect(section.getByRole("textbox")).toHaveCount(0);
      const tabs = page.getByRole("tablist", { name: "პორტფელის სექციები" });
      await expect(tabs.getByRole("tab")).toHaveCount(2);
      expect(
        await tabs.evaluate(
          (element) => element.scrollWidth <= element.clientWidth + 1,
        ),
      ).toBe(true);
      await expect(
        section.getByRole("link", {
          name: "ყველა პოზიციის ნახვა",
          exact: true,
        }),
      ).toHaveAttribute("href", base + "/positions");
      await expect(
        page
          .getByRole("region", { name: "ღირებულება და ისტორია" })
          .getByRole("button", { name: "7D", exact: true }),
      ).toBeVisible();
      await tabs
        .getByRole("tab", { name: "პოზიციები", exact: true })
        .press("ArrowRight");
      await expect(
        tabs.getByRole("tab", { name: "ბოლო ტრანზაქციები", exact: true }),
      ).toHaveAttribute("aria-selected", "true");
      await expect(page).toHaveURL(new RegExp(base + "$"));
      const recent = section.getByTestId("overview-recent-transactions");
      await expect(recent.locator("tbody tr")).toHaveCount(6);
      await expect(recent).toContainText("EXTRA");
      await expect(
        section.getByRole("button", { name: "შემდეგი", exact: true }),
      ).toHaveCount(0);
      await expect(
        section.getByRole("link", {
          name: "სრული ისტორიის ნახვა",
          exact: true,
        }),
      ).toHaveAttribute("href", base + "/transactions");
      await expect(page.locator(".recharts-area")).toBeVisible();
      if ([390, 1440].includes(width))
        await page.screenshot({
          path:
            ".local/overview-transactions-" +
            info.project.name +
            "-" +
            width +
            ".png",
          fullPage: true,
        });
      await tabs
        .getByRole("tab", { name: "ბოლო ტრანზაქციები", exact: true })
        .press("Home");
      await expect(
        tabs.getByRole("tab", { name: "პოზიციები", exact: true }),
      ).toHaveAttribute("aria-selected", "true");
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
      await page.evaluate(() => window.scrollTo(0, 0));
      const leaders = page.getByRole("region", {
        name: "დღის ლიდერები",
        exact: true,
      });
      await expect(leaders).toContainText("+5,5%");
      await expect(leaders).toContainText("-4,25%");
      for (const link of await leaders.getByRole("link").all()) {
        expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      const result = page.getByRole("region", {
        name: "პორტფელის ღირებულება და შედეგი",
        exact: true,
      });
      if (width < 1024) {
        const title = await result.getByRole("heading").first().boundingBox();
        const status = await result.locator("summary").boundingBox();
        expect(status!.y).toBeGreaterThanOrEqual(title!.y + title!.height);
      } else {
        const headings = await result.getByRole("heading").all();
        expect(
          Math.abs(
            (await headings[0].boundingBox())!.y -
              (await headings[1].boundingBox())!.y,
          ),
        ).toBeLessThanOrEqual(1);
        const chart = await page
          .getByRole("region", { name: "ღირებულება და ისტორია", exact: true })
          .boundingBox();
        const side = await page
          .getByRole("complementary", {
            name: "პორტფელის სტრუქტურა",
            exact: true,
          })
          .boundingBox();
        expect(
          Math.abs(chart!.y + chart!.height - side!.y - side!.height),
        ).toBeLessThanOrEqual(1);
      }
      if (width < 768) {
        expect((await leaders.boundingBox())!.height).toBeLessThan(130);
        const firstAsset = await assetList
          .locator("li a")
          .first()
          .boundingBox();
        const dock = await page
          .getByRole("navigation", { name: "მობილური ნავიგაცია", exact: true })
          .boundingBox();
        expect(firstAsset!.y).toBeLessThan(dock!.y);
      } else if (width < 1024) {
        const liquidity = await page
          .getByRole("region", {
            name: "USD ნაშთი და სტეიბლკოინები",
            exact: true,
          })
          .boundingBox();
        const daily = await leaders.boundingBox();
        expect(Math.abs(liquidity!.height - daily!.height)).toBeLessThanOrEqual(
          1,
        );
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
      .getByRole("tab", { name: "ბოლო ტრანზაქციები", exact: true })
      .click();
    await expect(
      page
        .getByTestId("overview-recent-transactions")
        .locator(".balance-value")
        .first(),
    ).toContainText("••••••");
    await page.getByRole("tab", { name: "პოზიციები", exact: true }).click();
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
