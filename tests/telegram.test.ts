import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFile, readdir } from "node:fs/promises";
import { eq } from "drizzle-orm";
import * as schema from "@/server/db/schema";
import type { Database } from "@/server/db";
import {
  telegramService,
  acceptTelegramLink,
  hashLink,
} from "@/server/telegram/service";
import { processTelegramDeliveries } from "@/server/telegram/delivery";
import { TelegramError, secretMatches } from "@/server/telegram/api";
import { evaluateWatchlistTargets } from "@/server/services/watchlist-notifications";
import { watchlistService } from "@/server/services/watchlist";
import { POST } from "@/app/api/telegram/webhook/route";
import { replyTelegramAssistant } from "@/server/telegram/assistant";
import { assistantReport } from "@/server/telegram/assistant-report";
const client = new PGlite(),
  testDb = drizzle(client, { schema }),
  db = testDb as unknown as Database;
vi.mock("@/server/db", () => ({ getDb: () => db }));
const fetchMock = vi.fn();
beforeAll(async () => {
  for (const file of (await readdir("drizzle"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await client.exec(await readFile(`drizzle/${file}`, "utf8"));
  await testDb.insert(schema.users).values([
    { id: "alice", name: "Alice", email: "alice@telegram.test" },
    { id: "bob", name: "Bob", email: "bob@telegram.test" },
  ]);
  await testDb.insert(schema.assets).values({
    id: "btc",
    symbol: "BTC",
    name: "Bitcoin",
    providerId: "bitcoin",
  });
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-only-not-a-token");
  vi.stubEnv("TELEGRAM_BOT_USERNAME", "CCXTRACKER_BOT");
  vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "x".repeat(40));
  vi.stubEnv("BETTER_AUTH_URL", "https://ccxtracker.example.test");
  vi.stubGlobal("fetch", fetchMock);
}, 60000);
beforeEach(async () => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(
    async () =>
      new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), {
        status: 200,
      }),
  );
  await testDb.delete(schema.telegramConnections);
  await testDb.delete(schema.suspendedUsers);
});
afterAll(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await client.close();
});
async function portfolio(userId = "alice") {
  const [p] = await testDb
    .insert(schema.portfolios)
    .values({ userId, name: "Telegram test" })
    .returning();
  return p;
}
function update(token: string, id = 123) {
  return {
    message: {
      text: `/start ${token}`,
      chat: { id, type: "private" },
      from: { id, is_bot: false, username: "owner" },
    },
  };
}
async function link(userId: string, pid: string, id = 123) {
  const svc = telegramService(db, userId),
    start = await svc.begin(pid),
    token = new URL(start.url).searchParams.get("start")!;
  await acceptTelegramLink(db, update(token, id));
  await svc.confirm();
  return svc;
}

it("suspended accounts cannot use the assistant even with a retained connection", async () => {
  const p = await portfolio();
  await link("alice", p.id);
  await testDb.insert(schema.suspendedUsers).values({ userId: "alice" });
  await replyTelegramAssistant(db, {
    update_id: 98764,
    message: {
      date: Math.floor(Date.now() / 1000),
      text: "/portfolio",
      chat: { id: 123, type: "private" },
      from: { id: 123, is_bot: false },
    },
  });
  expect(fetchMock).not.toHaveBeenCalled();
});

it("assistant only serves a confirmed private chat and suppresses provider retries", async () => {
  const p = await portfolio();
  const payload = {
    update_id: 98765,
    message: {
      date: Math.floor(Date.now() / 1000),
      text: "/help",
      chat: { id: 123, type: "private" },
      from: { id: 123, is_bot: false },
    },
  };
  await replyTelegramAssistant(db, payload);
  expect(fetchMock).not.toHaveBeenCalled();
  await link("alice", p.id);
  await replyTelegramAssistant(db, {
    ...payload,
    message: { ...payload.message, chat: { id: 123, type: "group" } },
  });
  expect(fetchMock).not.toHaveBeenCalled();
  await replyTelegramAssistant(db, payload);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).text).toContain(
    "/position XLM",
  );
  await replyTelegramAssistant(db, payload);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("assistant never reads another user's portfolio even with a tampered selection", async () => {
  const own = await portfolio();
  const foreign = await portfolio("bob");
  await testDb
    .insert(schema.assets)
    .values({ id: "USD", symbol: "USD", name: "US Dollar", providerId: "usd" })
    .onConflictDoNothing();
  await testDb.insert(schema.transactions).values({
    id: crypto.randomUUID(),
    portfolioId: foreign.id,
    assetId: "btc",
    kind: "deposit",
    quantity: "123",
    occurredAt: new Date(),
    sequence: 1,
  });
  await link("alice", own.id);
  await testDb
    .update(schema.telegramConnections)
    .set({ portfolioIds: [foreign.id] })
    .where(eq(schema.telegramConnections.userId, "alice"));
  await replyTelegramAssistant(db, {
    update_id: 98766,
    message: {
      date: Math.floor(Date.now() / 1000),
      text: "/position BTC",
      chat: { id: 123, type: "private" },
      from: { id: 123, is_bot: false },
    },
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).text).toContain(
    "პორტფელი ვერ მოიძებნა",
  );
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).text).not.toContain("123");
});
it("reports sale proceeds separately, values remaining holdings and ranks only fresh pending targets", async () => {
  const p = await portfolio();
  await testDb
    .insert(schema.assets)
    .values({ id: "USD", symbol: "USD", name: "Dollar", providerId: "usd" })
    .onConflictDoNothing();
  await testDb.insert(schema.transactions).values([
    {
      id: crypto.randomUUID(),
      portfolioId: p.id,
      assetId: "btc",
      kind: "deposit",
      quantity: "10",
      price: "10",
      occurredAt: new Date(Date.now() - 60000),
      sequence: 1,
    },
    {
      id: crypto.randomUUID(),
      portfolioId: p.id,
      assetId: "btc",
      kind: "sell",
      quantity: "4",
      price: "20",
      occurredAt: new Date(Date.now() - 30000),
      sequence: 2,
    },
  ]);
  await testDb
    .insert(schema.marketQuotes)
    .values({ assetId: "btc", price: "20", quotedAt: new Date() })
    .onConflictDoUpdate({
      target: schema.marketQuotes.assetId,
      set: { price: "20", quotedAt: new Date() },
    });
  const sale = await assistantReport(db, "alice", [p.id], {
    kind: "sales",
    symbol: "BTC",
  });
  expect(sale.body).toContain("გაყიდული: 4 BTC");
  expect(sale.body).toContain("წმინდა მიღებული: $80,00");
  expect(sale.body).toContain("გაყიდვების P/L: $40,00");
  expect(sale.links?.[0][0].url).toContain(`/portfolios/${p.id}/positions/btc`);
  const summary = await assistantReport(db, "alice", [p.id], {
    kind: "portfolio",
    portfolio: 1,
  });
  expect(summary.body).toContain("ღირებულება: $200,00");
  expect(summary.body).toContain("USD: $80,00");
  expect(summary.keyboard[0]).toContain("/portfolio 1");
  await testDb.insert(schema.watchlistItems).values({
    portfolioId: p.id,
    assetId: "btc",
    entryPrice: "15",
    exitPrice: "25",
    targetQuoteAt: new Date(),
    sellTargetQuoteAt: new Date(),
    targetActive: false,
    sellTargetActive: false,
  });
  const [plan] = await testDb
    .insert(schema.exitPlans)
    .values({
      portfolioId: p.id,
      assetId: "btc",
      telegramEnabled: true,
      alertQuantity: "6",
    })
    .returning();
  await testDb.insert(schema.exitLevels).values([
    {
      planId: plan.id,
      level: 1,
      price: "30",
      percentage: "20",
      alertArmed: true,
    },
    {
      planId: plan.id,
      level: 2,
      price: "40",
      percentage: "20",
      reachedAt: new Date(),
    },
  ]);
  const next = await assistantReport(db, "alice", [p.id], { kind: "next" });
  expect(next.body).toContain("დარჩენილია 25%");
  expect(next.body).toContain("დარჩენილია 50%");
  expect(next.body).not.toContain("TP2");
  const disabledWatch = await assistantReport(
    db,
    "alice",
    [p.id],
    { kind: "next" },
    { buyEnabled: false, sellEnabled: false },
  );
  expect(disabledWatch.body).not.toContain("დარჩენილია 25%");
  expect(disabledWatch.body).toContain("დარჩენილია 50%");
  const alerts = await assistantReport(db, "alice", [p.id], { kind: "alerts" });
  expect(alerts.body).not.toContain("TP2");
  expect(alerts.body).toContain("TP1");
  const history = await assistantReport(db, "alice", [p.id], {
    kind: "history",
  });
  expect(history.body).toContain("TP2");
  expect(history.body).not.toContain("TP1");
  expect(history.body).toContain("მიღწეული");
  await testDb
    .update(schema.watchlistItems)
    .set({ targetReachedAt: new Date(), targetReachedPrice: "14" })
    .where(eq(schema.watchlistItems.portfolioId, p.id));
  const afterReached = await assistantReport(db, "alice", [p.id], {
    kind: "alerts",
  });
  expect(afterReached.body).not.toContain("$15");
  expect(afterReached.body).toContain("$25");
  const watchHistory = await assistantReport(db, "alice", [p.id], {
    kind: "history",
  });
  expect(watchHistory.body).toContain("დაფიქსირდა $14");
  expect(watchHistory.body).not.toContain("$25");
  await testDb
    .update(schema.marketQuotes)
    .set({ quotedAt: new Date(Date.now() - 3600000) })
    .where(eq(schema.marketQuotes.assetId, "btc"));
  const stale = await assistantReport(db, "alice", [p.id], { kind: "next" });
  expect(stale.body).not.toContain("დარჩენილია");
  const denied = await assistantReport(db, "bob", [p.id], {
    kind: "portfolio",
  });
  expect(denied.body).not.toContain("$200");
  await testDb
    .delete(schema.marketQuotes)
    .where(eq(schema.marketQuotes.assetId, "btc"));
});

it("limits history to five, keeps explicit scope and unknown valuation, and offers safe links", async () => {
  const first = await portfolio();
  const second = await portfolio();
  await testDb
    .update(schema.portfolios)
    .set({ name: "მეორე & <პორტფელი>" })
    .where(eq(schema.portfolios.id, second.id));
  const now = Date.now();
  for (let i = 0; i < 6; i++)
    await testDb.insert(schema.transactions).values({
      id: crypto.randomUUID(),
      portfolioId: second.id,
      assetId: "btc",
      kind: "deposit",
      quantity: "1",
      price: null,
      sequence: i + 1,
      occurredAt: new Date(now - 60000 + i * 1000),
    });
  const history = await assistantReport(db, "alice", [first.id, second.id], {
    kind: "transactions",
    portfolio: 2,
  });
  expect(history.body.split("შეტანა").length - 1).toBe(5);
  expect(history.links?.[0][0].url).toContain(second.id);
  const summary = await assistantReport(db, "alice", [first.id, second.id], {
    kind: "portfolio",
    portfolio: 2,
  });
  expect(summary.body).toContain("მეორე & <პორტფელი>");
  expect(summary.body).toContain("ცნობილი ღირებულება");
  expect(summary.body).toContain("სრული P/L: —");
  const choose = await assistantReport(db, "alice", [first.id, second.id], {
    kind: "choose",
  });
  expect(choose.keyboard).toContainEqual(["/portfolio 2"]);
  expect(
    (
      await assistantReport(db, "alice", [first.id], {
        kind: "portfolio",
        portfolio: 2,
      })
    ).body,
  ).toContain("პორტფელი ვერ მოიძებნა");
});

async function crossing(pid: string) {
  const watch = watchlistService(db, "alice");
  await watch.save({
    portfolioId: pid,
    assetId: "btc",
    entryPrice: "5",
    exitPrice: "10",
    notes: "",
  });
  const now = Date.now();
  await evaluateWatchlistTargets(
    db,
    [
      {
        assetId: "btc",
        price: "8",
        change24h: null,
        stale: false,
        updatedAt: new Date(now - 1000).toISOString(),
      },
    ],
    pid,
  );
  await evaluateWatchlistTargets(
    db,
    [
      {
        assetId: "btc",
        price: "5",
        change24h: null,
        stale: false,
        updatedAt: new Date(now).toISOString(),
      },
    ],
    pid,
  );
}
describe("private Telegram connections and durable deliveries", () => {
  it("stores only a hashed, expiring link and requires CCX confirmation", async () => {
    const p = await portfolio(),
      svc = telegramService(db, "alice"),
      start = await svc.begin(p.id),
      token = new URL(start.url).searchParams.get("start")!;
    const [row] = await testDb.select().from(schema.telegramConnections);
    expect(row.linkHash).toBe(hashLink(token));
    expect(row.linkHash).not.toBe(token);
    expect(row.chatId).toBeNull();
    expect(await acceptTelegramLink(db, update(token))).toBe(true);
    expect((await svc.status()).connected).toBe(false);
    expect((await svc.status()).awaitingConfirmation).toBe(true);
    expect(await acceptTelegramLink(db, update(token, 999))).toBe(false);
    await svc.confirm();
    expect((await svc.status()).connected).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(svc.confirm()).rejects.toThrow("TELEGRAM_LINK_EXPIRED");
    expect(await acceptTelegramLink(db, update(token))).toBe(false);
  });
  it("rejects group chats, mismatched senders, expired links and other users' portfolios", async () => {
    const p = await portfolio(),
      svc = telegramService(db, "alice"),
      start = await svc.begin(p.id),
      token = new URL(start.url).searchParams.get("start")!;
    const group = update(token);
    group.message.chat.type = "group";
    expect(await acceptTelegramLink(db, group)).toBe(false);
    const mismatch = update(token);
    mismatch.message.from.id = 999;
    expect(await acceptTelegramLink(db, mismatch)).toBe(false);
    await testDb
      .update(schema.telegramConnections)
      .set({ linkExpiresAt: new Date(0) })
      .where(eq(schema.telegramConnections.userId, "alice"));
    expect(await acceptTelegramLink(db, update(token))).toBe(false);
    await expect(telegramService(db, "bob").begin(p.id)).rejects.toThrow(
      "RESOURCE_NOT_FOUND",
    );
    await expect(
      telegramService(db, "bob").preferences({
        buyEnabled: true,
        sellEnabled: true,
        portfolioIds: [p.id],
      }),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
  });
  it("does not allow a private chat to be linked to two CCX users", async () => {
    const p = await portfolio(),
      other = await portfolio("bob");
    await link("alice", p.id);
    const svc = telegramService(db, "bob"),
      start = await svc.begin(other.id);
    await acceptTelegramLink(
      db,
      update(new URL(start.url).searchParams.get("start")!),
    );
    await expect(svc.confirm()).rejects.toThrow();
    expect((await telegramService(db, "alice").status()).connected).toBe(true);
  });
  it("requires the webhook secret and validates incoming messages", async () => {
    expect(secretMatches("wrong", "x".repeat(40))).toBe(false);
    expect(
      (
        await POST(
          new Request("https://example.test/api/telegram/webhook", {
            method: "POST",
            body: "{}",
          }),
        )
      ).status,
    ).toBe(401);
    const p = await portfolio(),
      svc = telegramService(db, "alice"),
      start = await svc.begin(p.id),
      token = new URL(start.url).searchParams.get("start")!;
    const req = new Request("https://example.test/api/telegram/webhook", {
      method: "POST",
      headers: { "x-telegram-bot-api-secret-token": "x".repeat(40) },
      body: JSON.stringify(update(token)),
    });
    expect((await POST(req)).status).toBe(200);
    expect((await svc.status()).awaitingConfirmation).toBe(true);
    expect((await svc.status()).connected).toBe(false);
    const reply = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(reply.chat_id).toBe("123");
    expect(reply.reply_markup.inline_keyboard[0][0]).toEqual({
      text: "CCX-ში დაბრუნება",
      url: `https://ccxtracker.example.test/portfolios/${p.id}/settings#settings-telegram`,
    });
    expect(reply.text).not.toContain("ფასი");
    const request = (id = 123) =>
      new Request("https://example.test/api/telegram/webhook", {
        method: "POST",
        headers: { "x-telegram-bot-api-secret-token": "x".repeat(40) },
        body: JSON.stringify(update(token, id)),
      });
    // A stolen/replayed code in another chat cannot receive the return link.
    await POST(request(456));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockRejectedValueOnce(new Error("network failure"));
    expect((await POST(request())).status).toBe(500);
    expect((await POST(request())).status).toBe(200);
    await svc.confirm();
    await POST(request());
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it("sends a crossing to its owner's chat only and deduplicates processing", async () => {
    const p = await portfolio(),
      other = await portfolio("bob");
    await link("alice", p.id, 123);
    await link("bob", other.id, 456);
    await crossing(p.id);
    expect(await testDb.select().from(schema.telegramDeliveries)).toHaveLength(
      1,
    );
    expect(await processTelegramDeliveries(db)).toMatchObject({ sent: 1 });
    expect(await processTelegramDeliveries(db)).toMatchObject({ sent: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.chat_id).toBe("123");
    expect(payload.text).toContain("ფასის ვარდნის ალერტი");
    expect(payload.text).toMatch(/^BTC\n/);
    expect(payload.text).not.toContain("CCX ·");
    expect(payload.reply_markup.inline_keyboard[0][0].url).toContain(p.id);
  });
  it("does not deliver a queued watchlist alert after account suspension", async () => {
    const p = await portfolio();
    await link("alice", p.id);
    await crossing(p.id);
    expect(await testDb.select().from(schema.telegramDeliveries)).toHaveLength(
      1,
    );
    await testDb.insert(schema.suspendedUsers).values({ userId: "alice" });
    await processTelegramDeliveries(db);
    expect(fetchMock).not.toHaveBeenCalled();
    await testDb.delete(schema.suspendedUsers);
    await processTelegramDeliveries(db);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("sends each buy and sell target once across days and only resets the changed target", async () => {
    const p = await portfolio();
    await link("alice", p.id);
    await crossing(p.id);
    await processTelegramDeliveries(db);
    const base = Date.now();
    let clock = base;
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => clock);
    const check = async (price: string) => {
      clock += 1000;
      await evaluateWatchlistTargets(
        db,
        [
          {
            assetId: "btc",
            price,
            change24h: null,
            stale: false,
            updatedAt: new Date(clock).toISOString(),
          },
        ],
        p.id,
      );
    };
    try {
      // First sell crossing is still independent from the completed buy target.
      await check("10");
      await testDb
        .update(schema.telegramDeliveries)
        .set({ nextAttemptAt: new Date(0) });
      await processTelegramDeliveries(db);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const reached = (
        await testDb
          .select()
          .from(schema.watchlistItems)
          .where(eq(schema.watchlistItems.portfolioId, p.id))
      )[0];
      for (const day of [1, 2, 3]) {
        clock = base + day * 86400000;
        await check("8");
        await check("4");
        await check("12");
        expect(await processTelegramDeliveries(db)).toMatchObject({ sent: 0 });
      }
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(
        await testDb.select().from(schema.telegramDeliveries),
      ).toHaveLength(2);
      const after = (
        await testDb
          .select()
          .from(schema.watchlistItems)
          .where(eq(schema.watchlistItems.portfolioId, p.id))
      )[0];
      expect(after.targetReachedAt).toEqual(reached.targetReachedAt);
      expect(after.sellTargetReachedAt).toEqual(reached.sellTargetReachedAt);
      const watch = watchlistService(db, "alice");
      await watch.save({
        portfolioId: p.id,
        assetId: "btc",
        entryPrice: "5",
        exitPrice: "10",
        notes: "only a note changed",
      });
      await check("8");
      await check("4");
      expect(
        await testDb.select().from(schema.telegramDeliveries),
      ).toHaveLength(2);
      await watch.save({
        portfolioId: p.id,
        assetId: "btc",
        entryPrice: "3",
        exitPrice: "10",
        notes: "new buy target",
      });
      await check("4");
      await check("3");
      const jobs = await testDb.select().from(schema.telegramDeliveries);
      expect(jobs).toHaveLength(3);
      expect(jobs.filter((job) => job.side === "sell")).toHaveLength(1);
    } finally {
      nowSpy.mockRestore();
    }
  });
  it("respects portfolio and direction choices and cancels jobs on disconnect", async () => {
    const p = await portfolio(),
      svc = await link("alice", p.id);
    await svc.preferences({
      buyEnabled: false,
      sellEnabled: true,
      portfolioIds: [p.id],
    });
    await crossing(p.id);
    expect(await testDb.select().from(schema.telegramDeliveries)).toHaveLength(
      0,
    );
    await svc.preferences({
      buyEnabled: true,
      sellEnabled: true,
      portfolioIds: [p.id],
    });
    // A previously reached target stays consumed; a new target is a new alert.
    await watchlistService(db, "alice").save({
      portfolioId: p.id,
      assetId: "btc",
      entryPrice: "4",
      exitPrice: "10",
      notes: "",
    });
    const t = Date.now();
    for (const [i, price] of ["8", "4"].entries())
      await evaluateWatchlistTargets(
        db,
        [
          {
            assetId: "btc",
            price,
            change24h: null,
            stale: false,
            updatedAt: new Date(t + i + 1000).toISOString(),
          },
        ],
        p.id,
      );
    expect(await testDb.select().from(schema.telegramDeliveries)).toHaveLength(
      1,
    );
    await svc.disconnect();
    expect(await testDb.select().from(schema.telegramDeliveries)).toHaveLength(
      0,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("keeps retryable failures queued and pauses a blocked bot", async () => {
    const p = await portfolio();
    await link("alice", p.id);
    await crossing(p.id);
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: false,
          error_code: 429,
          parameters: { retry_after: 60 },
        }),
        { status: 429 },
      ),
    );
    expect(await processTelegramDeliveries(db)).toMatchObject({ failed: 1 });
    const [job] = await testDb.select().from(schema.telegramDeliveries);
    expect(job.attempts).toBe(1);
    expect(job.sentAt).toBeNull();
    expect(job.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + 50000);
    await testDb
      .update(schema.telegramDeliveries)
      .set({ nextAttemptAt: new Date(0) })
      .where(eq(schema.telegramDeliveries.id, job.id));
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, error_code: 403 }), {
        status: 403,
      }),
    );
    await processTelegramDeliveries(db);
    const status = await telegramService(db, "alice").status();
    expect(status.buyEnabled).toBe(true);
    expect(status.sellEnabled).toBe(true);
    expect(status.lastError).toBe("BOT_BLOCKED");
  });
  it("never sends an obsolete target or a queue from a previous connection", async () => {
    const p = await portfolio();
    await link("alice", p.id);
    await crossing(p.id);
    await watchlistService(db, "alice").save({
      portfolioId: p.id,
      assetId: "btc",
      entryPrice: "3",
      exitPrice: "10",
      notes: "",
    });
    expect(await processTelegramDeliveries(db)).toMatchObject({ sent: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not expose Telegram response text or bot credentials on failure", async () => {
    const p = await portfolio(),
      svc = await link("alice", p.id);
    fetchMock.mockRejectedValueOnce(new Error("private-url-token"));
    await expect(svc.test()).rejects.toEqual(new TelegramError(0));
  });
});
it("keeps terminal failures visible and retries them only after explicit recovery", async () => {
  const p = await portfolio(),
    svc = await link("alice", p.id);
  await crossing(p.id);
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify({ ok: false, error_code: 403 }), {
      status: 403,
    }),
  );
  await processTelegramDeliveries(db);
  expect((await svc.status()).lastError).toBe("BOT_BLOCKED");
  await expect(svc.retryFailed()).rejects.toThrow("TELEGRAM_BOT_BLOCKED");
  expect(
    (await watchlistService(db, "alice").list(p.id))[0].targetDelivery,
  ).toBe("failed");
  await svc.test();
  expect((await svc.status()).lastError).toBeNull();
  expect((await svc.status()).buyEnabled).toBe(true);
  await svc.retryFailed();
  await processTelegramDeliveries(db);
  expect(
    (await watchlistService(db, "alice").list(p.id))[0].targetDelivery,
  ).toBe("sent");
  const before = fetchMock.mock.calls.length;
  await svc.retryFailed();
  await processTelegramDeliveries(db);
  expect(fetchMock).toHaveBeenCalledTimes(before);
});
it("baselines Watchlist enrollment from a fresh cached price", async () => {
  const p = await portfolio();
  await link("alice", p.id);
  const now = Date.now();
  await testDb
    .insert(schema.marketQuotes)
    .values({ assetId: "btc", price: "4", quotedAt: new Date(now - 10000) });
  await watchlistService(db, "alice").save({
    portfolioId: p.id,
    assetId: "btc",
    entryPrice: null,
    exitPrice: "5",
    notes: "",
  });
  await evaluateWatchlistTargets(
    db,
    [
      {
        assetId: "btc",
        price: "5",
        change24h: null,
        stale: false,
        updatedAt: new Date(now).toISOString(),
      },
    ],
    p.id,
  );
  expect(await testDb.select().from(schema.telegramDeliveries)).toHaveLength(1);
});
