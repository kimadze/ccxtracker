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
    expect(payload.text).toContain("შესყიდვის");
    expect(payload.text).toMatch(/^BTC\n/);
    expect(payload.text).not.toContain("CCX ·");
    expect(payload.reply_markup.inline_keyboard[0][0].url).toContain(p.id);
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
    expect(status.buyEnabled).toBe(false);
    expect(status.sellEnabled).toBe(false);
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
