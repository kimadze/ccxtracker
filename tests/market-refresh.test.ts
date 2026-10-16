import { beforeAll, beforeEach, afterAll, it, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFile, readdir } from "node:fs/promises";
import { eq, like } from "drizzle-orm";
import * as schema from "@/server/db/schema";
import type { Database } from "@/server/db";
import type { Asset } from "@/domain/types";
const mocks = vi.hoisted(() => ({
  db: null as unknown as Database,
  quotes: vi.fn(),
}));
vi.mock("@/server/db", () => ({ getDb: () => mocks.db }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/server/market/provider", () => ({
  CoinGeckoProvider: class {
    quotes = mocks.quotes;
  },
}));
vi.mock("@/server/services/watchlist-notifications", () => ({
  evaluateWatchlistTargets: vi.fn(),
}));
vi.mock("@/server/telegram/delivery", () => ({
  processTelegramDeliveries: vi.fn(),
}));
vi.mock("@/server/telegram/take-profit", () => ({
  evaluateTakeProfits: vi.fn(),
  processTakeProfitDeliveries: vi.fn(),
}));
import { getQuotes } from "@/server/market";
const client = new PGlite();
const db = drizzle(client, { schema });
const assets: Asset[] = ["btc", "eth"].map((id) => ({
  id,
  symbol: id.toUpperCase(),
  name: id,
  providerId: id,
  isStablecoin: false,
}));
beforeAll(async () => {
  for (const file of (await readdir("drizzle"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await client.exec(await readFile(`drizzle/${file}`, "utf8"));
  mocks.db = db as unknown as Database;
  await db.insert(schema.assets).values(assets);
  vi.stubEnv("COINGECKO_DEMO_API_KEY", "test-only");
});
beforeEach(async () => {
  await db.delete(schema.marketQuotes);
  await db.delete(schema.jobState);
  mocks.quotes.mockReset().mockImplementation(async (requested: Asset[]) =>
    requested.map((a) => ({
      assetId: a.id,
      price: "123",
      change24h: null,
      updatedAt: new Date().toISOString(),
      stale: false,
    })),
  );
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await client.close();
});
it("returns refreshed quotes on the first render and reuses fresh cache", async () => {
  expect(await getQuotes([assets[0]])).toMatchObject([
    { assetId: "btc", price: "123.000000000000000000", stale: false },
  ]);
  await getQuotes([assets[0]]);
  expect(mocks.quotes).toHaveBeenCalledTimes(1);
});
it("retains a competing request and drains it with the next worker", async () => {
  await db.insert(schema.jobState).values({
    key: "market-refresh",
    leaseUntil: new Date(Date.now() + 60000),
  });
  expect(await getQuotes([assets[0]])).toEqual([]);
  expect(
    await db
      .select()
      .from(schema.jobState)
      .where(like(schema.jobState.key, "market-pending:%")),
  ).toHaveLength(1);
  await db
    .update(schema.jobState)
    .set({ leaseUntil: new Date(0) })
    .where(eq(schema.jobState.key, "market-refresh"));
  expect(await getQuotes([assets[1]])).toMatchObject([
    { assetId: "eth", price: "123.000000000000000000" },
  ]);
  expect(await db.select().from(schema.marketQuotes)).toHaveLength(2);
  expect(
    await db
      .select()
      .from(schema.jobState)
      .where(like(schema.jobState.key, "market-pending:%")),
  ).toHaveLength(0);
});
it("keeps failed requests retryable and preserves the last known price", async () => {
  await db.insert(schema.marketQuotes).values({
    assetId: "btc",
    price: "99",
    quotedAt: new Date(0),
    fetchedAt: new Date(0),
  });
  mocks.quotes.mockRejectedValueOnce(new Error("provider unavailable"));
  const log = vi.spyOn(console, "warn").mockImplementation(() => {});
  expect(await getQuotes([assets[0]])).toMatchObject([
    { price: "99.000000000000000000", stale: true },
  ]);
  expect(
    await db
      .select()
      .from(schema.jobState)
      .where(like(schema.jobState.key, "market-pending:%")),
  ).toHaveLength(1);
  expect(await getQuotes([assets[0]])).toMatchObject([
    { price: "123.000000000000000000", stale: false },
  ]);
  log.mockRestore();
});
