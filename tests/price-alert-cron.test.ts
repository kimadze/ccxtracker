// Unit requests have no Next.js request lifecycle; digest delivery is tested separately.
import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFile, readdir } from "node:fs/promises";
import * as schema from "@/server/db/schema";
import type { Database } from "@/server/db";
import { targetTransition } from "@/domain/watchlist-target";
import { POST } from "@/app/api/cron/watchlist/route";
const client = new PGlite(),
  db = drizzle(client, { schema }) as unknown as Database;
vi.mock("@/server/db", () => ({ getDb: () => db }));
const quotesMock = vi.hoisted(() => vi.fn(async () => [] as unknown[]));
vi.mock("@/server/market", () => ({ getQuotes: quotesMock }));
vi.mock("@/server/job-alerts", () => ({ sendJobAlert: vi.fn() }));
vi.mock("@/server/services/watchlist-notifications", () => ({
  evaluateWatchlistTargets: vi.fn(),
}));
vi.mock("@/server/telegram/delivery", () => ({
  processTelegramDeliveries: async () => ({
    sent: 0,
    failed: 0,
    configured: true,
  }),
}));
vi.mock("@/server/telegram/take-profit", () => ({
  evaluateTakeProfits: vi.fn(),
  processTakeProfitDeliveries: async () => ({ sent: 0, failed: 0 }),
}));
beforeAll(async () => {
  for (const file of (await readdir("drizzle"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await client.exec(await readFile(`drizzle/${file}`, "utf8"));
  vi.stubEnv("CRON_SECRET", "x".repeat(40));
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-only");
  vi.stubEnv("TELEGRAM_BOT_USERNAME", "CCXTRACKER_BOT");
  vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "x".repeat(40));
  vi.stubEnv("BETTER_AUTH_URL", "https://ccxtracker.example.test");
  await db
    .insert(schema.users)
    .values({ id: "audit", name: "Audit", email: "audit@example.test" });
  const [p] = await db
    .insert(schema.portfolios)
    .values({ userId: "audit", name: "audit" })
    .returning();
  await db.insert(schema.assets).values({
    id: "audit-btc",
    symbol: "BTC",
    name: "BTC",
    providerId: "bitcoin",
  });
  await db
    .insert(schema.telegramConnections)
    .values({ userId: "audit", chatId: "123", portfolioIds: [p.id] });
  await db
    .insert(schema.watchlistItems)
    .values({ portfolioId: p.id, assetId: "audit-btc", entryPrice: "5" });
}, 60000);
afterAll(async () => {
  vi.unstubAllEnvs();
  await client.close();
});
it("reports missing usable quotes as failure instead of checked success", async () => {
  const response = await POST(
    new Request("https://example.test/api/cron/watchlist", {
      method: "POST",
      headers: { authorization: `Bearer ${"x".repeat(40)}` },
    }),
  );
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({
    checked: 0,
    requested: 1,
    missing: 1,
    degraded: true,
    sent: 0,
    failed: 0,
    configured: true,
  });
});
it("does not invent a crossing when no valid enrollment baseline exists", () => {
  const now = Date.now();
  expect(
    targetTransition(
      "5",
      false,
      null,
      {
        assetId: "btc",
        price: "6",
        change24h: null,
        stale: false,
        updatedAt: new Date(now).toISOString(),
      },
      now,
      "sell",
    )?.notify,
  ).toBe(false);
});

it("reports successful usable observation and persists heartbeat", async () => {
  quotesMock.mockResolvedValueOnce([
    {
      assetId: "audit-btc",
      price: "6",
      change24h: null,
      stale: false,
      updatedAt: new Date().toISOString(),
    },
  ]);
  const response = await POST(
    new Request("https://example.test/api/cron/watchlist", {
      method: "POST",
      headers: { authorization: `Bearer ${"x".repeat(40)}` },
    }),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    checked: 1,
    requested: 1,
    missing: 0,
    degraded: false,
  });
  const health = (await db.select().from(schema.jobState)).find(
    (r) => r.key === "watchlist-health",
  )!;
  expect(health.leaseUntil.getTime()).toBeGreaterThan(Date.now() - 10000);
});
it("refuses unauthenticated scheduler calls", async () => {
  expect(
    (
      await POST(
        new Request("https://example.test/api/cron/watchlist", {
          method: "POST",
        }),
      )
    ).status,
  ).toBe(401);
});

it("accepts the separate price-alert scheduler secret", async () => {
  vi.stubEnv("PRICE_ALERT_CRON_SECRET", "p".repeat(40));
  quotesMock.mockResolvedValueOnce([]);
  try {
    const response = await POST(
      new Request("https://example.test/api/cron/watchlist", {
        method: "POST",
        headers: { authorization: `Bearer ${"p".repeat(40)}` },
      }),
    );
    expect(response.status).toBe(503); // Authenticated, but quotes unavailable.
    expect(await response.json()).toMatchObject({ requested: 1, missing: 1 });
  } finally {
    vi.stubEnv("PRICE_ALERT_CRON_SECRET", "");
  }
});

it("supports the installed Production spelling without widening endpoint access", async () => {
  vi.stubEnv("PRICE_ALERT_CRON_SECRET", undefined);
  vi.stubEnv("PRICE_ALERT_CRON_SECRE", "p".repeat(40));
  quotesMock.mockResolvedValueOnce([]);
  try {
    const response = await POST(
      new Request("https://example.test/api/cron/watchlist", {
        method: "POST",
        headers: { authorization: `Bearer ${"p".repeat(40)}` },
      }),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ requested: 1, missing: 1 });
    expect(
      (
        await POST(
          new Request("https://example.test/api/cron/watchlist", {
            headers: { authorization: `Bearer ${"wrong".repeat(10)}` },
          }),
        )
      ).status,
    ).toBe(401);
  } finally {
    vi.stubEnv("PRICE_ALERT_CRON_SECRE", "");
    vi.stubEnv("PRICE_ALERT_CRON_SECRET", "");
  }
});

vi.mock("next/server", () => ({ after: vi.fn() }));
