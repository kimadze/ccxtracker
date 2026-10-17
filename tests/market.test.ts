import {
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFile, readdir } from "node:fs/promises";
import * as schema from "@/server/db/schema";
import type { Database } from "@/server/db";
import { coinGeckoRequest } from "@/server/market/request";
import { cleanupRateLimits, consumeRateLimit } from "@/server/rate-limit";
import { getAssetMarketStatistics } from "@/server/market/statistics";
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
const client = new PGlite();
const db = drizzle(client, { schema }) as unknown as Database;
vi.mock("@/server/db", () => ({ getDb: () => db }));
beforeAll(async () => {
  for (const file of (await readdir("drizzle"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await client.exec(await readFile(`drizzle/${file}`, "utf8"));
});
beforeEach(async () => {
  await db.delete(schema.rateLimits);
  await db.delete(schema.jobState);
});
afterAll(() => client.close());
import { CoinGeckoProvider } from "@/server/market/provider";
const assets = [
  {
    id: "btc",
    providerId: "bitcoin",
    symbol: "BTC",
    name: "Bitcoin",
    isStablecoin: false,
  },
];
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("market provider boundary", () => {
  it("reserves quote capacity and shares admission across provider instances", async () => {
    vi.stubEnv("COINGECKO_DEMO_API_KEY", "test-only");
    vi.stubEnv("COINGECKO_REQUESTS_PER_MINUTE", "4");
    const network = vi.fn(async (url: string) =>
      Response.json(url.includes("/coins/markets") ? [] : { coins: [] }),
    );
    vi.stubGlobal("fetch", network);
    await getAssetMarketStatistics(["bitcoin"]);
    for (let i = 0; i < 2; i++) await new CoinGeckoProvider().search("BTC");
    await expect(new CoinGeckoProvider().search("ETH")).rejects.toThrow(
      "MARKET_RATE_LIMIT",
    );
    await coinGeckoRequest("/simple/price?ids=bitcoin");
    await expect(
      coinGeckoRequest("/simple/price?ids=ethereum"),
    ).rejects.toThrow("MARKET_RATE_LIMIT");
    expect(network).toHaveBeenCalledTimes(4);
  });
  it("retains provider retry-after across search and quote requests", async () => {
    vi.stubEnv("COINGECKO_DEMO_API_KEY", "test-only");
    const network = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 429, headers: { "retry-after": "120" } }),
      )
      .mockResolvedValue(Response.json({}));
    vi.stubGlobal("fetch", network);
    const started = Date.now();
    await expect(coinGeckoRequest("/simple/price?ids=bitcoin")).rejects.toThrow(
      "MARKET_REQUEST_FAILED_429",
    );
    await expect(new CoinGeckoProvider().search("BTC")).rejects.toThrow(
      "MARKET_RATE_LIMIT",
    );
    expect(network).toHaveBeenCalledTimes(1);
    const [backoff] = await db.select().from(schema.jobState);
    expect(backoff.leaseUntil.getTime()).toBeGreaterThanOrEqual(
      started + 120000,
    );
    await db.update(schema.jobState).set({ leaseUntil: new Date(0) });
    await coinGeckoRequest("/simple/price?ids=bitcoin");
    expect(network).toHaveBeenCalledTimes(2);
  });
  it("enforces an atomic budget under concurrent requests and renews its window", async () => {
    vi.stubEnv("COINGECKO_DEMO_API_KEY", "test-only");
    vi.stubEnv("COINGECKO_REQUESTS_PER_MINUTE", "4");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({})),
    );
    const time = Date.now();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(time);
    const attempts = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        coinGeckoRequest("/simple/price?ids=bitcoin"),
      ),
    );
    expect(attempts.filter((r) => r.status === "fulfilled")).toHaveLength(4);
    expect(fetch).toHaveBeenCalledTimes(4);
    vi.setSystemTime(time + 60001);
    await coinGeckoRequest("/simple/price?ids=bitcoin");
    expect(fetch).toHaveBeenCalledTimes(5);
  });
  it("cleans expired records in bounded batches without resetting active dedup or budgets", async () => {
    const time = Date.now();
    await db.insert(schema.rateLimits).values([
      ...[1, 2, 3].map((i) => ({
        id: `old-${i}`,
        key: `telegram-assistant-update:old-${i}`,
        count: 1,
        lastRequest: time - 8 * 86400000,
      })),
      {
        id: "recent",
        key: "telegram-assistant-update:recent",
        count: 1,
        lastRequest: time - 86400000,
      },
      { id: "budget", key: "coingecko-global", count: 20, lastRequest: time },
    ]);
    expect(await cleanupRateLimits(db, 2)).toBe(2);
    expect(
      await consumeRateLimit(
        "telegram-assistant-update:recent",
        1,
        86400000 * 2,
        db,
      ),
    ).toBe(false);
    expect(await consumeRateLimit("coingecko-global", 20, 60000, db)).toBe(
      false,
    );
    expect(await cleanupRateLimits(db, 2)).toBe(1);
    expect(
      (await db.select().from(schema.rateLimits)).map((r) => r.id).sort(),
    ).toEqual(["budget", "recent"]);
  });
  it("classifies verified stablecoin identities without trusting a reused symbol", async () => {
    vi.stubEnv("COINGECKO_DEMO_API_KEY", "test-only");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          coins: [
            { id: "dai", symbol: "DAI", name: "Dai" },
            { id: "fake-dai", symbol: "DAI", name: "Fake Dai" },
          ],
        }),
      ),
    );
    const result = await new CoinGeckoProvider().search("DAI");
    expect(result[0]).toMatchObject({
      isStablecoin: true,
      category: "stablecoin",
    });
    expect(result[1]).toMatchObject({ isStablecoin: false, category: "other" });
  });
  it("does not invent quotes when no provider is configured", async () => {
    vi.stubEnv("COINGECKO_DEMO_API_KEY", "");
    await expect(new CoinGeckoProvider().quotes(assets)).rejects.toThrow(
      "MARKET_NOT_CONFIGURED",
    );
  });
  it("preserves unavailable quotes and marks old provider timestamps stale", async () => {
    vi.stubEnv("COINGECKO_DEMO_API_KEY", "test-only");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({}))
        .mockResolvedValueOnce(
          Response.json({
            bitcoin: {
              usd: 150,
              last_updated_at: (Date.now() - 3600000) / 1000,
            },
          }),
        ),
    );
    const provider = new CoinGeckoProvider();
    expect(await provider.quotes(assets)).toEqual([]);
    expect((await provider.quotes(assets))[0]).toMatchObject({
      price: "150",
      stale: true,
      change24h: null,
    });
  });
  it("rejects malformed prices and propagates provider throttling", async () => {
    vi.stubEnv("COINGECKO_DEMO_API_KEY", "test-only");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({ bitcoin: { usd: -1, last_updated_at: 1 } }),
        )
        .mockResolvedValueOnce(new Response(null, { status: 429 })),
    );
    await expect(new CoinGeckoProvider().quotes(assets)).rejects.toThrow();
    await expect(new CoinGeckoProvider().quotes(assets)).rejects.toThrow(
      "MARKET_REQUEST_FAILED_429",
    );
  });
});
