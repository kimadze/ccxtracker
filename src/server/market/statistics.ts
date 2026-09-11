import "server-only";
import { z } from "zod";
import type {
  MarketOverview,
  MarketStatisticAsset,
  MarketStatistics,
} from "@/domain/statistics";

const nullableNumber = z.number().finite().nullable();
const marketAssetSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  image: z.string().nullable().optional(),
  market_cap_rank: z.number().int().positive().nullable(),
  current_price: nullableNumber,
  price_change_percentage_1h_in_currency: nullableNumber.optional(),
  price_change_percentage_24h_in_currency: nullableNumber.optional(),
  price_change_percentage_7d_in_currency: nullableNumber.optional(),
  market_cap: nullableNumber,
  total_volume: nullableNumber,
  circulating_supply: nullableNumber,
  sparkline_in_7d: z.object({ price: z.array(z.number().finite()) }).optional(),
});
const globalSchema = z.object({
  data: z.object({
    total_market_cap: z.record(z.string(), z.number().finite()),
    total_volume: z.record(z.string(), z.number().finite()),
    market_cap_percentage: z.record(z.string(), z.number().finite()),
    market_cap_change_percentage_24h_usd: z.number().finite().optional(),
    updated_at: z.number().positive(),
  }),
});

function value(input: number | null | undefined) {
  return input == null ? null : String(input);
}

async function request(path: string) {
  const key = process.env.COINGECKO_DEMO_API_KEY;
  if (!key) throw new Error("MARKET_NOT_CONFIGURED");
  const response = await fetch(`https://api.coingecko.com/api/v3${path}`, {
    headers: { "x-cg-demo-api-key": key },
    signal: AbortSignal.timeout(12000),
    next: { revalidate: 300 },
  });
  if (!response.ok) throw new Error(`MARKET_REQUEST_FAILED_${response.status}`);
  return response.json() as Promise<unknown>;
}

export async function getMarketStatistics(): Promise<MarketStatistics> {
  try {
    const [rawAssets, rawGlobal, rawStablecoins] = await Promise.all([
      request(
        "/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=true&price_change_percentage=1h,24h,7d",
      ),
      request("/global"),
      request(
        "/coins/markets?vs_currency=usd&category=stablecoins&order=market_cap_desc&per_page=100&page=1&sparkline=false",
      ),
    ]);
    const parsedAssets = z.array(marketAssetSchema).parse(rawAssets);
    const global = globalSchema.parse(rawGlobal).data;
    const stablecoins = z.array(marketAssetSchema).parse(rawStablecoins);
    const assets: MarketStatisticAsset[] = parsedAssets.map((asset) => ({
      id: asset.id,
      symbol: asset.symbol.toUpperCase(),
      name: asset.name,
      image: asset.image ?? null,
      rank: asset.market_cap_rank,
      price: value(asset.current_price),
      change1h: value(asset.price_change_percentage_1h_in_currency),
      change24h: value(asset.price_change_percentage_24h_in_currency),
      change7d: value(asset.price_change_percentage_7d_in_currency),
      marketCap: value(asset.market_cap),
      volume24h: value(asset.total_volume),
      circulatingSupply: value(asset.circulating_supply),
      sparkline7d: asset.sparkline_in_7d?.price ?? [],
    }));
    const overview: MarketOverview = {
      totalMarketCap: value(global.total_market_cap.usd),
      volume24h: value(global.total_volume.usd),
      btcDominance: value(global.market_cap_percentage.btc),
      ethDominance: value(global.market_cap_percentage.eth),
      stablecoinMarketCap: String(
        stablecoins.reduce((sum, asset) => sum + (asset.market_cap ?? 0), 0),
      ),
      updatedAt: new Date(global.updated_at * 1000).toISOString(),
      source: "CoinGecko",
    };
    return { overview, assets, error: false };
  } catch (error) {
    console.warn("Market statistics unavailable", error);
    return { overview: null, assets: [], error: true };
  }
}
