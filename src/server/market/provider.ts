import "server-only";
import { z } from "zod";
import type { Asset, Quote } from "@/domain/types";
import { amount } from "@/domain/decimal";

export interface MarketPriceProvider {
  search(query: string): Promise<Asset[]>;
  quotes(assets: Asset[]): Promise<Quote[]>;
}
const coinSchema = z.object({
  id: z.string().max(120),
  symbol: z.string().max(30),
  name: z.string().max(150),
});
const quoteSchema = z.record(
  z.string(),
  z.object({
    usd: z.number().positive().finite(),
    usd_24h_change: z.number().finite().nullable().optional(),
    last_updated_at: z.number().positive(),
  }),
);

export class CoinGeckoProvider implements MarketPriceProvider {
  private async request(path: string) {
    const key = process.env.COINGECKO_DEMO_API_KEY;
    if (!key) throw new Error("MARKET_NOT_CONFIGURED");
    const response = await fetch(`https://api.coingecko.com/api/v3${path}`, {
      headers: { "x-cg-demo-api-key": key },
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!response.ok)
      throw new Error(`MARKET_REQUEST_FAILED_${response.status}`);
    return response.json() as Promise<unknown>;
  }
  async search(query: string): Promise<Asset[]> {
    const data = z
      .object({ coins: z.array(coinSchema) })
      .parse(await this.request(`/search?query=${encodeURIComponent(query)}`));
    return data.coins.slice(0, 12).map((c) => ({
      id: c.id,
      providerId: c.id,
      symbol: c.symbol.toUpperCase(),
      name: c.name,
      isStablecoin: false,
    }));
  }
  async quotes(assets: Asset[]): Promise<Quote[]> {
    if (!assets.length) return [];
    const data = quoteSchema.parse(
      await this.request(
        `/simple/price?ids=${encodeURIComponent(assets.map((a) => a.providerId).join(","))}&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true`,
      ),
    );
    return assets.flatMap((asset) => {
      const quote = data[asset.providerId];
      if (!quote) return [];
      return [
        {
          assetId: asset.id,
          price: amount(quote.usd),
          change24h:
            quote.usd_24h_change == null ? null : amount(quote.usd_24h_change),
          updatedAt: new Date(quote.last_updated_at * 1000).toISOString(),
          stale: Date.now() - quote.last_updated_at * 1000 > 15 * 60000,
        },
      ];
    });
  }
}
