import { afterEach, describe, expect, it, vi } from "vitest";
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
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("market provider boundary", () => {
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
