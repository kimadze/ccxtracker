import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, afterAll, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFile, readdir } from "node:fs/promises";
import { eq } from "drizzle-orm";
import * as schema from "@/server/db/schema";
import type { Database } from "@/server/db";
import {
  digestClock,
  enqueueDailyDigests,
  processDailyDigests,
  collectDailyDigest,
} from "@/server/telegram/digest";
import { telegramService } from "@/server/telegram/service";
const client = new PGlite(),
  testDb = drizzle(client, { schema }),
  db = testDb as unknown as Database;
vi.mock("@/server/db", () => ({ getDb: () => db }));
vi.mock("@/server/market", () => ({ getQuotes: async () => [] }));
const ai = vi.hoisted(() => vi.fn());
vi.mock("@/server/ai/client", () => ({
  aiConfigured: () => true,
  lunaJson: ai,
}));
const fetcher = vi.fn();
let pid: string;
const now = new Date("2026-10-12T17:01:00Z");
beforeAll(async () => {
  for (const file of (await readdir("drizzle"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await client.exec(await readFile(`drizzle/${file}`, "utf8"));
  await testDb.insert(schema.users).values([
    { id: "owner", name: "Owner", email: "owner@digest.test" },
    { id: "other", name: "Other", email: "other@digest.test" },
  ]);
  const [p] = await testDb
    .insert(schema.portfolios)
    .values({ userId: "owner", name: "My portfolio" })
    .returning();
  pid = p.id;
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-only");
  vi.stubEnv("TELEGRAM_BOT_USERNAME", "CCXTRACKER_BOT");
  vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "x".repeat(40));
  vi.stubEnv("BETTER_AUTH_URL", "https://ccxtracker.example.test");
  vi.stubGlobal("fetch", fetcher);
}, 60000);
beforeEach(async () => {
  await testDb.delete(schema.telegramDigests);
  await testDb.delete(schema.transactions);
  await testDb.delete(schema.snapshots);
  await testDb.delete(schema.telegramConnections);
  await testDb.insert(schema.telegramConnections).values({
    userId: "owner",
    chatId: "123",
    summaryEnabled: true,
    summaryHour: 21,
    portfolioIds: [pid],
  });
  fetcher.mockReset();
  fetcher.mockResolvedValue(
    new Response(JSON.stringify({ ok: true, result: { message_id: 1 } })),
  );
  ai.mockReset();
});
afterAll(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await client.close();
});
it("uses the Tbilisi calendar boundary", () =>
  expect(digestClock(new Date("2026-10-12T20:01:00Z"))).toEqual({
    day: "2026-10-13",
    hour: 0,
  }));
it("waits for the selected hour, sends once per day and permits the next day", async () => {
  await enqueueDailyDigests(db, new Date("2026-10-12T16:59:00Z"));
  expect(await testDb.select().from(schema.telegramDigests)).toHaveLength(0);
  expect(await processDailyDigests(db, now)).toEqual({ sent: 1, failed: 0 });
  await processDailyDigests(db, now);
  expect(fetcher).toHaveBeenCalledTimes(1);
  await processDailyDigests(db, new Date("2026-10-13T17:01:00Z"));
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("does not send without consent or expose another owner's portfolio", async () => {
  await testDb
    .update(schema.telegramConnections)
    .set({ summaryEnabled: false })
    .where(eq(schema.telegramConnections.userId, "owner"));
  await processDailyDigests(db, now);
  expect(fetcher).not.toHaveBeenCalled();
  const [p] = await testDb
    .insert(schema.portfolios)
    .values({ userId: "other", name: "Private" })
    .returning();
  await testDb
    .update(schema.telegramConnections)
    .set({ summaryEnabled: true, portfolioIds: [p.id] })
    .where(eq(schema.telegramConnections.userId, "owner"));
  await processDailyDigests(db, now);
  expect(fetcher).not.toHaveBeenCalled();
});
it("cancels pending summaries when preferences change", async () => {
  await enqueueDailyDigests(db, now);
  await telegramService(db, "owner").preferences({
    buyEnabled: true,
    sellEnabled: true,
    summaryEnabled: false,
    portfolioIds: [pid],
  });
  await processDailyDigests(db, now);
  expect(fetcher).not.toHaveBeenCalled();
  expect((await testDb.select().from(schema.telegramDigests))[0].attempts).toBe(
    5,
  );
});
it("keeps the daily reservation after disconnect/reconnect", async () => {
  await processDailyDigests(db, now);
  await telegramService(db, "owner").disconnect();
  await testDb.insert(schema.telegramConnections).values({
    userId: "owner",
    chatId: "123",
    summaryEnabled: true,
    summaryHour: 21,
    portfolioIds: [pid],
  });
  await processDailyDigests(db, now);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("never calls AI, even if a legacy preference was enabled", async () => {
  await testDb
    .update(schema.telegramConnections)
    .set({ summaryAiEnabled: true })
    .where(eq(schema.telegramConnections.userId, "owner"));
  expect(await processDailyDigests(db, now)).toEqual({ sent: 1, failed: 0 });
  expect(ai).not.toHaveBeenCalled();
  expect(JSON.parse(fetcher.mock.calls[0][1].body).text).not.toContain("Luna");
});
it("retries a failed delivery without rebuilding or duplicating a completed digest", async () => {
  fetcher.mockResolvedValueOnce(
    new Response(JSON.stringify({ ok: false, error_code: 500 }), {
      status: 500,
    }),
  );
  expect(await processDailyDigests(db, now)).toEqual({ sent: 0, failed: 1 });
  await testDb.update(schema.telegramDigests).set({ nextAttemptAt: now });
  expect(await processDailyDigests(db, now)).toEqual({ sent: 1, failed: 0 });
  await processDailyDigests(db, now);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(JSON.parse(fetcher.mock.calls[0][1].body).text).toBe(
    JSON.parse(fetcher.mock.calls[1][1].body).text,
  );
});

it("rebuilds legacy cached reports and sends HTML only for the daily report", async () => {
  await enqueueDailyDigests(db, now);
  await testDb
    .update(schema.telegramDigests)
    .set({ body: "<b>დღიური ანგარიში · ძველი</b>\nსრული P/L: $10" });
  await processDailyDigests(db, now);
  const payload = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(payload.parse_mode).toBe("HTML");
  expect(payload.text).toContain("<b>დღიური ანგარიში");
  expect(payload.text).not.toContain("ძველი");
});
it("uses only owned midnight valuations, adjusts cash funding and omits alert lists", async () => {
  await testDb
    .insert(schema.assets)
    .values({
      id: "USD",
      symbol: "USD",
      name: "US Dollar",
      providerId: "usd",
      isStablecoin: true,
    })
    .onConflictDoNothing();
  await testDb.insert(schema.transactions).values([
    {
      id: randomUUID(),
      portfolioId: pid,
      assetId: "USD",
      kind: "deposit",
      quantity: "1000",
      price: null,
      fee: "0",
      sequence: 1,
      occurredAt: new Date("2026-10-11T10:00:00Z"),
    },
    {
      id: randomUUID(),
      portfolioId: pid,
      assetId: "USD",
      kind: "deposit",
      quantity: "500",
      price: null,
      fee: "0",
      sequence: 2,
      occurredAt: new Date("2026-10-12T06:00:00Z"),
    },
  ]);
  await testDb.insert(schema.snapshots).values({
    portfolioId: pid,
    day: "2026-10-11",
    capturedAt: new Date("2026-10-11T20:00:00Z"),
    value: "1000",
    cash: "1000",
    revision: 1,
  });
  await enqueueDailyDigests(db, now);
  const [job] = await testDb.select().from(schema.telegramDigests);
  const report = await collectDailyDigest(db, job, now);
  expect(report.portfolios[0].change).toMatchObject({
    amount: "0",
    percent: "0",
    from: "2026-10-11T20:00:00.000Z",
  });
  expect(report.portfolios[0].summary.value).toBe("1500");
  await processDailyDigests(db, now);
  const text = JSON.parse(fetcher.mock.calls[0][1].body).text;
  expect(text).toContain("დღის შედეგი · 00:00–21:01: <b>$0,00 · 0%</b>");
  expect(text).toContain("პორტფელის ღირებულება: <b>$1 500,00</b>");
  expect(text).not.toContain("ალერტი");
  expect(text).not.toContain("P/L");
});
it("shows unavailable change when the midnight valuation is missing", async () => {
  await enqueueDailyDigests(db, now);
  const [job] = await testDb.select().from(schema.telegramDigests);
  expect(
    (await collectDailyDigest(db, job, now)).portfolios[0].change,
  ).toMatchObject({ amount: null, reason: "დღის საწყისი შეფასება არ გვაქვს" });
});
