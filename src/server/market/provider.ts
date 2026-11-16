import "server-only";
import { z } from "zod";
import type { Asset, Quote } from "@/domain/types";
import { amount } from "@/domain/decimal";
import { highResLogoUrl } from "@/lib/asset-logo";
import { isKnownUsdStablecoin } from "@/domain/asset-classification";
import { coinGeckoRequest } from "./request";

export interface MarketPriceProvider {
  search(query: string): Promise<Asset[]>;
  quotes(assets: Asset[]): Promise<Quote[]>;
}
const coinSchema = z.object({
  id: z.string().max(120),
  symbol: z.string().max(30),
  name: z.string().max(150),
  thumb: z.string().url().nullable().optional(),
});
const quoteResponseSchema = z.record(z.string(), z.unknown());
const quoteSchema = z.object({
  usd: z.number().positive().finite(),
  usd_24h_change: z.number().finite().nullable().optional(),
  last_updated_at: z.number().positive().max(8_640_000_000_000),
});

export class CoinGeckoProvider implements MarketPriceProvider {
  private async request(path: string) {
    return coinGeckoRequest(path);
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
      logoUrl: highResLogoUrl(c.thumb),
      isStablecoin: isKnownUsdStablecoin(c.id),
      category: isKnownUsdStablecoin(c.id) ? "stablecoin" : "other",
    }));
  }
  async quotes(assets: Asset[]): Promise<Quote[]> {
    if (!assets.length) return [];
    const data = quoteResponseSchema.parse(
      await this.request(
        `/simple/price?ids=${encodeURIComponent(assets.map((a) => a.providerId).join(","))}&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true`,
      ),
    );
    return assets.flatMap((asset) => {
      // A malformed quote should not block valid prices in the same response.
      const parsed = quoteSchema.safeParse(data[asset.providerId]);
      if (!parsed.success) return [];
      const quote = parsed.data;
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
