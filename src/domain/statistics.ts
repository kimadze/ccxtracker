import { decimal } from "./decimal";

export interface MarketStatisticAsset {
  id: string;
  symbol: string;
  name: string;
  image: string | null;
  rank: number | null;
  price: string | null;
  change1h: string | null;
  change24h: string | null;
  change7d: string | null;
  marketCap: string | null;
  volume24h: string | null;
  circulatingSupply: string | null;
  sparkline7d: number[];
}

export interface MarketOverview {
  totalMarketCap: string | null;
  volume24h: string | null;
  btcDominance: string | null;
  ethDominance: string | null;
  stablecoinMarketCap: string | null;
  updatedAt: string;
  source: string;
}

export interface MarketStatistics {
  overview: MarketOverview | null;
  assets: MarketStatisticAsset[];
  error: boolean;
}

export interface MacroMetric {
  id: string;
  label: string;
  value: string | null;
  unit: "%" | "index" | "number";
  observationDate: string | null;
  source: string;
  change: string | null;
}

export interface MacroStatistics {
  metrics: MacroMetric[];
  fetchedAt: string;
  error: boolean;
}

export function topMovers(assets: MarketStatisticAsset[], count = 3) {
  const eligible = assets.filter((asset) => asset.change24h !== null);
  const gainers = [...eligible]
    .sort((a, b) => decimal(b.change24h!).cmp(decimal(a.change24h!)))
    .slice(0, count);
  const losers = [...eligible]
    .sort((a, b) => decimal(a.change24h!).cmp(decimal(b.change24h!)))
    .slice(0, count);
  return { gainers, losers };
}

export function percentageChange(current: string, previous: string) {
  const prior = decimal(previous);
  if (prior.isZero()) return null;
  return decimal(current).minus(prior).div(prior).mul(100).toFixed(6);
}

export function latestObservation(
  observations: { date: string; value: string }[],
) {
  const valid = observations.filter(
    (item) => item.value !== "." && Number.isFinite(Number(item.value)),
  );
  return valid.length ? valid[valid.length - 1] : null;
}
