import { beforeAll, afterAll, beforeEach, it, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import * as s from "@/server/db/schema";
import type { Database } from "@/server/db";
import { strategyService } from "@/server/services/strategy";
import {
  evaluateTakeProfits,
  processTakeProfitDeliveries,
} from "@/server/telegram/take-profit";
const client = new PGlite(),
  db = drizzle(client, { schema: s }) as unknown as Database;
const fetchMock = vi.fn();
beforeAll(async () => {
  for (const file of (await readdir("drizzle"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await client.exec(await readFile(`drizzle/${file}`, "utf8"));
  await db.insert(s.users).values([
    { id: "alice", name: "Alice", email: "alice@tp.test" },
    { id: "bob", name: "Bob", email: "bob@tp.test" },
  ]);
  await db.insert(s.assets).values({
    id: "btc",
    symbol: "BTC",
    name: "Bitcoin",
    providerId: "bitcoin",
  });
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-only-token");
  vi.stubEnv("TELEGRAM_BOT_USERNAME", "CCXTRACKER_BOT");
  vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "x".repeat(40));
  vi.stubEnv("BETTER_AUTH_URL", "https://ccxtracker.example.test");
  vi.stubGlobal("fetch", fetchMock);
}, 60000);
beforeEach(async () => {
  await db.delete(s.portfolios);
  await db.delete(s.telegramConnections);
  await db.delete(s.takeProfitDeliveries);
  fetchMock.mockReset();
  fetchMock.mockImplementation(
    async () =>
      new Response(JSON.stringify({ ok: true, result: { message_id: 1 } })),
  );
});
afterAll(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await client.close();
});
async function setup() {
  const [p] = await db
    .insert(s.portfolios)
    .values({ userId: "alice", name: "TP test" })
    .returning();
  await db.insert(s.transactions).values({
    id: randomUUID(),
    portfolioId: p.id,
    assetId: "btc",
    kind: "deposit",
    quantity: "10",
    price: null,
    fee: "0",
    occurredAt: new Date(Date.now() - 86400000),
    sequence: 1,
  });
  await db
    .insert(s.telegramConnections)
    .values({ userId: "alice", chatId: "123", portfolioIds: [p.id] })
    .onConflictDoNothing();
  const input = {
    portfolioId: p.id,
    assetId: "btc",
    feePercent: "0",
    telegramEnabled: true,
    levels: [
      { price: "10", percentage: "25" },
      { price: "20", percentage: "50" },
    ],
  };
  const service = strategyService(db, "alice");
  await service.saveExit(input);
  return { p, input, service };
}
async function quote(price: string, offset = 0, stale = false) {
  await evaluateTakeProfits(db, [
    {
      assetId: "btc",
      price,
      change24h: null,
      stale,
      updatedAt: new Date(Date.now() - 5000 + offset).toISOString(),
    },
  ]);
}
it("supports unknown basis, groups reached levels and sends once without financial changes", async () => {
  const { p } = await setup();
  await quote("5");
  await quote("21", 1000);
  const jobs = await db.select().from(s.takeProfitDeliveries);
  expect(jobs).toHaveLength(1);
  expect(jobs[0].levels.map((l) => l.quantity)).toEqual(["2.5", "5"]);
  expect(await processTakeProfitDeliveries(db)).toEqual({ sent: 1, failed: 0 });
  await processTakeProfitDeliveries(db);
  await quote("30", 2000);
  await processTakeProfitDeliveries(db);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const message = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(message.chat_id).toBe("123");
  expect(message.text).toContain("TP1");
  expect(message.text).toContain("TP2");
  expect(message.text).not.toContain("CCX ·");
  expect(message.reply_markup.inline_keyboard[0][0].text).toBe(
    "პოზიციის გახსნა",
  );
  expect(
    await db
      .select()
      .from(s.transactions)
      .where(eq(s.transactions.portfolioId, p.id)),
  ).toHaveLength(1);
});
it("establishes an already-above baseline without sending and rejects stale quotes", async () => {
  await setup();
  await quote("21", 0, true);
  expect(await db.select().from(s.takeProfitDeliveries)).toHaveLength(0);
  await quote("21", 0);
  await quote("22", 1000);
  expect(await db.select().from(s.takeProfitDeliveries)).toHaveLength(0);
  await quote("5", 2000);
  await quote("21", 3000);
  expect(await db.select().from(s.takeProfitDeliveries)).toHaveLength(1);
});
it("preserves reached state on an unchanged save and allows explicit rearming", async () => {
  const { p, input, service } = await setup();
  await quote("5");
  await quote("21", 1000);
  await processTakeProfitDeliveries(db);
  await service.saveExit(input);
  const plan = (await service.load(p.id, "btc")).plan!;
  expect(plan.levels.every((l) => l.reachedAt)).toBe(true);
  await service.rearmExit(p.id, "btc", plan.levels[0].id);
  await quote("5", 2000);
  await quote("21", 3000);
  await processTakeProfitDeliveries(db);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).text).not.toContain("TP2");
});
it("rejects another owner's saves and level rearming", async () => {
  const { p, input, service } = await setup();
  const level = (await service.load(p.id, "btc")).plan!.levels[0];
  await expect(strategyService(db, "bob").saveExit(input)).rejects.toThrow(
    "RESOURCE_NOT_FOUND",
  );
  await expect(
    strategyService(db, "bob").rearmExit(p.id, "btc", level.id),
  ).rejects.toThrow("RESOURCE_NOT_FOUND");
});
it("suppresses queued alerts after quantity changes", async () => {
  const { p } = await setup();
  await quote("5");
  await quote("21", 1000);
  await db
    .update(s.transactions)
    .set({ quantity: "8" })
    .where(eq(s.transactions.portfolioId, p.id));
  expect(await processTakeProfitDeliveries(db)).toEqual({ sent: 0, failed: 0 });
  expect(fetchMock).not.toHaveBeenCalled();
});
it("cancels old episodes after changing targets", async () => {
  const { input, service } = await setup();
  await quote("5");
  await quote("21", 1000);
  await service.saveExit({
    ...input,
    levels: [{ price: "30", percentage: "50" }],
  });
  expect(await processTakeProfitDeliveries(db)).toEqual({ sent: 0, failed: 0 });
  expect(fetchMock).not.toHaveBeenCalled();
});
it("cancels queued alerts when alerts are disabled", async () => {
  const { input, service } = await setup();
  await quote("5");
  await quote("21", 1000);
  await service.saveExit({ ...input, telegramEnabled: false });
  expect(await processTakeProfitDeliveries(db)).toEqual({ sent: 0, failed: 0 });
  expect(fetchMock).not.toHaveBeenCalled();
});
it("retries provider rate limits and cancels alerts after disconnect", async () => {
  await setup();
  await quote("5");
  await quote("21", 1000);
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
  expect(await processTakeProfitDeliveries(db)).toEqual({ sent: 0, failed: 1 });
  const [job] = await db.select().from(s.takeProfitDeliveries);
  expect(job.attempts).toBe(1);
  expect(job.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + 50000);
  await db.delete(s.telegramConnections);
  await db.update(s.takeProfitDeliveries).set({ nextAttemptAt: new Date(0) });
  await processTakeProfitDeliveries(db);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
