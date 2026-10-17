import { test, expect } from "@playwright/test";
import { Client } from "pg";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

test("journal and scenario drafts survive conflicts and cancelled navigation", async ({
  page,
  context,
}, info) => {
  test.setTimeout(180000);
  const user = `alice-${info.project.name}`;
  const cookies = JSON.parse(await readFile(".local/e2e-cookies.json", "utf8"));
  await context.addCookies([
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
  const pid = randomUUID(),
    secondPid = randomUUID(),
    sid = randomUUID();
  const other = await context.newPage();
  try {
    await db.query(
      "INSERT INTO portfolios(id,user_id,name) VALUES($1,$2,'მონახაზის დაცვა')",
      [pid, user],
    );
    await db.query(
      "INSERT INTO portfolios(id,user_id,name) VALUES($1,$2,'მეორე პორტფელი')",
      [secondPid, user],
    );
    await db.query(
      "INSERT INTO assets(id,provider_id,symbol,name) VALUES('bitcoin','bitcoin','BTC','Bitcoin'),('ethereum','ethereum','ETH','Ethereum') ON CONFLICT DO NOTHING",
    );
    for (const [i, asset] of ["bitcoin", "ethereum"].entries()) {
      await db.query(
        "INSERT INTO transactions(id,portfolio_id,asset_id,kind,quantity,price,fee,occurred_at,sequence) VALUES(gen_random_uuid(),$1,$2,'deposit',10,1,0,now()-interval '1 day',$3)",
        [pid, asset, i + 1],
      );
      await db.query(
        "INSERT INTO market_quotes(asset_id,price,quoted_at) VALUES($1,10,now()) ON CONFLICT(asset_id) DO UPDATE SET price=10,quoted_at=now(),fetched_at=now()",
        [asset],
      );
    }
    await db.query(
      "INSERT INTO position_journals(portfolio_id,asset_id,thesis) VALUES($1,'bitcoin','პირველი ვერსია')",
      [pid],
    );
    const journal = `/portfolios/${pid}/journal?asset=bitcoin`;
    await page.goto(journal, { waitUntil: "networkidle" });
    await other.goto(`/portfolios/${pid}`, { waitUntil: "networkidle" });
    await other.goto(journal, { waitUntil: "networkidle" });
    const thesis = page.getByLabel("საინვესტიციო თეზისი");
    await thesis.fill("შენახული ახალი ვერსია");
    await page
      .getByRole("button", { name: "ჟურნალის შენახვა", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("ჟურნალი შენახულია");
    await other
      .getByLabel("საინვესტიციო თეზისი")
      .fill("ჩემი შეუნახავი მონახაზი");
    await other
      .getByRole("button", { name: "ჟურნალის შენახვა", exact: true })
      .click();
    await expect(
      other.getByRole("alert").filter({ hasText: "სხვა მოქმედებით შეიცვალა" }),
    ).toContainText("სხვა მოქმედებით შეიცვალა");
    await expect(other.getByLabel("საინვესტიციო თეზისი")).toHaveValue(
      "ჩემი შეუნახავი მონახაზი",
    );
    if (await other.evaluate(() => "navigation" in window)) {
      const prompt = other.waitForEvent("dialog", { timeout: 5000 });
      const back = other.goBack({ timeout: 3000 }).catch(() => null);
      const dialog = await prompt;
      expect(["confirm", "beforeunload"]).toContain(dialog.type());
      if (dialog.type() === "confirm")
        expect(dialog.message()).toContain("ცვლილებები შეუნახავია");
      await dialog.dismiss();
      await back;
      await expect(other).toHaveURL(new RegExp(`/journal\\?asset=bitcoin$`));
    }
    expect(
      (
        await db.query(
          "SELECT thesis FROM position_journals WHERE portfolio_id=$1",
          [pid],
        )
      ).rows[0].thesis,
    ).toBe("შენახული ახალი ვერსია");
    other.once("dialog", (dialog) => dialog.dismiss());
    await other.getByLabel("პოზიციის არჩევა").selectOption("ethereum");
    await expect(other.getByLabel("პოზიციის არჩევა")).toHaveValue("bitcoin");
    await other.setViewportSize({ width: 1440, height: 900 });
    other.once("dialog", (dialog) => dialog.dismiss());
    await other.getByLabel("პორტფელის არჩევა").selectOption(secondPid);
    await expect(other.getByLabel("პორტფელის არჩევა")).toHaveValue(pid);
    other.once("dialog", (dialog) => dialog.dismiss());
    await other.getByRole("button", { name: "გასვლა", exact: true }).click();
    await expect(other.getByLabel("საინვესტიციო თეზისი")).toHaveValue(
      "ჩემი შეუნახავი მონახაზი",
    );
    other.once("dialog", (dialog) => dialog.dismiss());
    await other.locator(`a[href="/portfolios/${pid}"]:visible`).first().click();
    await expect(other.getByLabel("საინვესტიციო თეზისი")).toHaveValue(
      "ჩემი შეუნახავი მონახაზი",
    );
    for (const width of [360, 390, 430, 768, 1024, 1440]) {
      await other.setViewportSize({ width, height: 844 });
      expect(
        await other.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      if (width === 390 || width === 1440)
        await other.screenshot({
          path: `.local/draft-conflict-${width}-${info.project.name}.png`,
          fullPage: true,
          animations: "disabled",
        });
    }
    await db.query(
      "INSERT INTO portfolio_scenarios(id,portfolio_id,name) VALUES($1,$2,'შენახული სცენარი')",
      [sid, pid],
    );
    const scenario = `/portfolios/${pid}/planning?tab=scenarios`;
    await page.goto(scenario, { waitUntil: "networkidle" });
    other.once("dialog", (dialog) => dialog.accept());
    await other.goto(scenario, { waitUntil: "networkidle" });
    for (const editor of [page, other])
      await editor.getByLabel("შენახული სცენარი").selectOption(sid);
    await page.getByLabel("BTC — სამიზნე ფასი (USD)").fill("15");
    await page.getByRole("button", { name: "შენახვა", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("სცენარი შენახულია");
    await other.getByLabel("BTC — სამიზნე ფასი (USD)").fill("25");
    await other.getByRole("button", { name: "შენახვა", exact: true }).click();
    await expect(
      other.getByRole("alert").filter({ hasText: "სხვა მოქმედებით შეიცვალა" }),
    ).toContainText("სხვა მოქმედებით შეიცვალა");
    await expect(other.getByLabel("BTC — სამიზნე ფასი (USD)")).toHaveValue(
      "25",
    );
    other.once("dialog", (dialog) => dialog.dismiss());
    await other.getByLabel("შენახული სცენარი").selectOption("");
    await expect(other.getByLabel("შენახული სცენარი")).toHaveValue(sid);
    other.once("dialog", (dialog) => dialog.dismiss());
    await other.getByRole("tab", { name: "სტრატეგია", exact: true }).click();
    await expect(other).toHaveURL(/tab=scenarios$/);
    const activeTab = other.getByRole("tab", {
      name: "სცენარები",
      exact: true,
    });
    await activeTab.focus();
    other.once("dialog", (dialog) => dialog.dismiss());
    await activeTab.press("ArrowLeft");
    await expect(activeTab).toBeFocused();
    await expect(other).toHaveURL(/tab=scenarios$/);
    expect(
      (
        await db.query(
          "SELECT price::text FROM scenario_asset_prices WHERE scenario_id=$1 AND asset_id='bitcoin'",
          [sid],
        )
      ).rows[0].price,
    ).toMatch(/^15\.0+$/);
    other.once("dialog", (dialog) => dialog.accept());
    await other.getByRole("tab", { name: "სტრატეგია", exact: true }).click();
    await expect(other).toHaveURL(/tab=strategy$/);
    await other.getByLabel("კაპიტალი + საკომისიო (USD)").fill("750");
    if (await other.evaluate(() => "navigation" in window)) {
      const prompt = other.waitForEvent("dialog", { timeout: 5000 });
      const back = other.goBack({ timeout: 3000 }).catch(() => null);
      const dialog = await prompt;
      expect(["confirm", "beforeunload"]).toContain(dialog.type());
      await dialog.dismiss();
      await back;
      await expect(other).toHaveURL(/tab=strategy$/);
      await expect(other.getByLabel("კაპიტალი + საკომისიო (USD)")).toHaveValue(
        "750",
      );
    }
  } finally {
    await other.close();
    await db.query("DELETE FROM portfolios WHERE id IN ($1,$2)", [
      pid,
      secondPid,
    ]);
    await db.end();
  }
});
