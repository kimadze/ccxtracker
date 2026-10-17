import { beforeAll, beforeEach, afterAll, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFile, readdir } from "node:fs/promises";
import { eq } from "drizzle-orm";
import * as schema from "@/server/db/schema";
import type { Database } from "@/server/db";
import { drainTelegramQueues } from "@/server/telegram/queue";
import { runSnapshots, retrySkippedSnapshots } from "@/server/snapshots";
import { portfolioService } from "@/server/services/portfolio";
const client = new PGlite(),
  testDb = drizzle(client, { schema }),
  db = testDb as unknown as Database;
vi.mock("@/server/db", () => ({ getDb: () => db }));
vi.mock("@/server/market", () => ({ getQuotes: async () => [] }));
vi.mock("@/server/telegram/send-pacing", () => ({
  waitForTelegramSlot: async () => {},
}));
const fetcher = vi.fn();
beforeAll(async () => {
  for (const file of (await readdir("drizzle"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await client.exec(await readFile(`drizzle/${file}`, "utf8"));
  await testDb.insert(schema.users).values(
    Array.from({ length: 10 }, (_, i) => ({
      id: `u${i}`,
      name: `User ${i}`,
      email: `u${i}@jobs.test`,
    })),
  );
  await testDb.insert(schema.assets).values({
    id: "btc",
    providerId: "bitcoin",
    name: "Bitcoin",
    symbol: "BTC",
  });
  await testDb.insert(schema.assets).values({
    id: "USD",
    providerId: "usd-cash",
    name: "US Dollar",
    symbol: "USD",
    category: "cash",
  });
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-only");
  vi.stubEnv("TELEGRAM_BOT_USERNAME", "CCXTRACKER_BOT");
  vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "x".repeat(40));
  vi.stubEnv("BETTER_AUTH_URL", "https://ccxtracker.example.test");
  vi.stubGlobal("fetch", fetcher);
}, 60000);
beforeEach(async () => {
  await testDb.delete(schema.telegramDigests);
  await testDb.delete(schema.telegramConnections);
  await testDb.delete(schema.portfolios);
  await testDb.delete(schema.jobState);
  fetcher.mockReset();
  fetcher.mockImplementation(async () =>
    Response.json({ ok: true, result: { message_id: 1 } }),
  );
});
afterAll(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await client.close();
});
async function reports() {
  for (let i = 0; i < 10; i++) {
    const [p] = await testDb
      .insert(schema.portfolios)
      .values({ userId: `u${i}`, name: `Portfolio ${i}` })
      .returning();
    await testDb.insert(schema.telegramConnections).values({
      userId: `u${i}`,
      chatId: String(100 + i),
      summaryEnabled: true,
      summaryHour: 0,
      portfolioIds: [p.id],
    });
  }
}
it("gives Watchlist, TP and reports a turn in the same round", async () => {
  await reports();
  const [connection] = await testDb
    .select()
    .from(schema.telegramConnections)
    .where(eq(schema.telegramConnections.userId, "u0"));
  const portfolioId = connection.portfolioIds[0],
    reachedAt = new Date();
  await testDb
    .insert(schema.transactions)
    .values({
      id: crypto.randomUUID(),
      portfolioId,
      assetId: "btc",
      kind: "deposit",
      quantity: "10",
      price: "1",
      fee: "0",
      occurredAt: new Date(Date.now() - 86400000),
      sequence: 1,
    });
  const [watch] = await testDb
    .insert(schema.watchlistItems)
    .values({
      portfolioId,
      assetId: "btc",
      entryPrice: "5",
      targetReachedAt: reachedAt,
      targetReachedPrice: "4",
    })
    .returning();
  await testDb
    .insert(schema.telegramDeliveries)
    .values({
      userId: "u0",
      generation: connection.generation,
      watchlistId: watch.id,
      side: "buy",
      reachedAt,
      target: "5",
      price: "4",
    });
  const [plan] = await testDb
    .insert(schema.exitPlans)
    .values({
      portfolioId,
      assetId: "btc",
      telegramEnabled: true,
      alertQuantity: "10",
    })
    .returning();
  await testDb
    .insert(schema.exitLevels)
    .values({
      planId: plan.id,
      level: 1,
      price: "20",
      percentage: "25",
      reachedAt,
      reachedPrice: "21",
    });
  await testDb
    .insert(schema.takeProfitDeliveries)
    .values({
      planId: plan.id,
      generation: plan.alertGeneration,
      connectionGeneration: connection.generation,
      reachedAt,
      price: "21",
      levels: [{ level: 1, price: "20", percentage: "25", quantity: "2.5" }],
    });
  const result = await drainTelegramQueues(db, {
    maxRounds: 1,
    deadline: Date.now() + 120000,
  });
  expect(result.watchlist.sent).toBe(1);
  expect(result.takeProfit.sent).toBe(1);
  expect(result.digest.sent).toBe(1);
  expect(result.pending).toBe(9);
  const remaining = await drainTelegramQueues(db, {
    deadline: Date.now() + 120000,
  });
  expect(remaining.watchlist.sent).toBe(0);
  expect(remaining.takeProfit.sent).toBe(0);
  expect(remaining.digest.sent).toBe(9);
});
it("drains ten users' reports in one invocation and never sends them twice", async () => {
  await reports();
  const result = await drainTelegramQueues(db, {
    deadline: Date.now() + 120000,
  });
  expect(result.digest).toEqual({ sent: 10, failed: 0 });
  expect(result.pending).toBe(0);
  expect(fetcher).toHaveBeenCalledTimes(10);
  for (const [index, call] of fetcher.mock.calls.entries()) {
    const body = JSON.parse(call[1].body);
    expect(body.chat_id).toBe(String(100 + index));
    expect(body.text).toContain(`Portfolio ${index}`);
  }
  expect((await drainTelegramQueues(db)).digest.sent).toBe(0);
  expect(fetcher).toHaveBeenCalledTimes(10);
});
it("retains rate-limited reports, honors retry_after and delivers the retry once", async () => {
  await reports();
  fetcher.mockResolvedValueOnce(
    Response.json(
      { ok: false, error_code: 429, parameters: { retry_after: 60 } },
      { status: 429 },
    ),
  );
  const result = await drainTelegramQueues(db, {
    deadline: Date.now() + 120000,
  });
  expect(result.digest).toEqual({ sent: 9, failed: 1 });
  expect(result.pending).toBe(1);
  expect(result.ready).toBe(0);
  expect((await drainTelegramQueues(db)).digest.sent).toBe(0);
  const jobs = await testDb.select().from(schema.telegramDigests);
  const retry = jobs.find((j) => !j.sentAt)!;
  expect(retry.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + 50000);
  await testDb
    .update(schema.telegramDigests)
    .set({ nextAttemptAt: new Date(0) })
    .where(eq(schema.telegramDigests.id, retry.id));
  expect(
    (await drainTelegramQueues(db, { deadline: Date.now() + 120000 })).digest
      .sent,
  ).toBe(1);
  expect((await drainTelegramQueues(db)).pending).toBe(0);
});
it("respects time and batch bounds without dropping remaining reports", async () => {
  await reports();
  expect(
    (await drainTelegramQueues(db, { deadline: Date.now() - 1 }))
      .budgetExhausted,
  ).toBe(true);
  expect(fetcher).not.toHaveBeenCalled();
  const bounded = await drainTelegramQueues(db, {
    maxRounds: 2,
    deadline: Date.now() + 120000,
  });
  expect(bounded.digest.sent).toBe(2);
  expect(bounded.pending).toBe(8);
  expect(
    (await drainTelegramQueues(db, { deadline: Date.now() + 120000 })).digest
      .sent,
  ).toBe(8);
});
async function skipped() {
  const service = portfolioService(db, "u0"),
    p = await service.create({ name: "Retry snapshot" });
  await service.mutateTransaction(
    {
      id: crypto.randomUUID(),
      portfolioId: p.id,
      assetId: "btc",
      kind: "deposit",
      quantity: "1",
      price: "100",
      fee: "0",
      notes: "",
      occurredAt: "2026-01-01T00:00:00Z",
    },
    "create",
    0,
  );
  await runSnapshots({ db, loadQuotes: async () => [] });
  return p.id;
}
it("retries a skipped current-day valuation after five minutes without repeating a snapshot", async () => {
  const id = await skipped(),
    key = `snapshot-retry:${id}`;
  expect((await retrySkippedSnapshots({ db })).processed).toBe(0);
  await testDb
    .update(schema.jobState)
    .set({ leaseUntil: new Date(0) })
    .where(eq(schema.jobState.key, key));
  const result = await retrySkippedSnapshots({
    db,
    loadQuotes: async () => [
      {
        assetId: "btc",
        price: "150",
        change24h: null,
        stale: false,
        updatedAt: new Date().toISOString(),
      },
    ],
  });
  expect(result.created).toBe(1);
  expect(await testDb.select().from(schema.snapshots)).toHaveLength(1);
  expect(
    (await testDb.select().from(schema.jobState)).some((j) => j.key === key),
  ).toBe(false);
  expect((await retrySkippedSnapshots({ db })).created).toBe(0);
});
it("keeps incomplete retries pending and never backfills yesterday with today's prices", async () => {
  const id = await skipped(),
    key = `snapshot-retry:${id}`;
  await testDb
    .update(schema.jobState)
    .set({ leaseUntil: new Date(0) })
    .where(eq(schema.jobState.key, key));
  expect(
    (await retrySkippedSnapshots({ db, loadQuotes: async () => [] })).failed,
  ).toBe(1);
  const [pending] = await testDb
    .select()
    .from(schema.jobState)
    .where(eq(schema.jobState.key, key));
  expect(pending.leaseUntil.getTime()).toBeGreaterThan(Date.now() + 290000);
  await testDb
    .update(schema.jobState)
    .set({
      leaseUntil: new Date(0),
      cursor: JSON.stringify({ day: "2000-01-01", attempts: 1 }),
    })
    .where(eq(schema.jobState.key, key));
  expect((await retrySkippedSnapshots({ db })).expired).toBe(1);
  expect(await testDb.select().from(schema.snapshots)).toHaveLength(0);
});
