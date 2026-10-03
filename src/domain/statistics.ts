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
  updatedAt?: string | null;
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
  stablecoinIds?: string[];
}

export interface MacroMetric {
  id: string;
  label: string;
  value: string | null;
  unit: "%" | "index" | "number";
  observationDate: string | null;
  source: string;
  change: string | null;
  changeUnit: "პპ" | "პუნქტი" | "%";
  available: boolean;
  history?: { date: string; value: string }[];
  previousDate?: string | null;
  sourceUrl?: string;
}

export interface MacroStatistics {
  metrics: MacroMetric[];
  fetchedAt: string;
  error: boolean;
}

export type MarketPeriod = "1h" | "24h" | "7d";

export function marketChange(
  asset: MarketStatisticAsset,
  period: MarketPeriod,
) {
  return period === "1h"
    ? asset.change1h
    : period === "7d"
      ? asset.change7d
      : asset.change24h;
}

export function marketBreadth(
  assets: MarketStatisticAsset[],
  period: MarketPeriod,
  stablecoinIds: string[] = [],
) {
  const excluded = new Set(stablecoinIds);
  const sample = assets.filter((asset) => !excluded.has(asset.id));
  let rising = 0,
    falling = 0,
    unchanged = 0,
    missing = 0;
  for (const asset of sample) {
    const change = marketChange(asset, period);
    if (change === null) missing++;
    else if (decimal(change).gt(0)) rising++;
    else if (decimal(change).lt(0)) falling++;
    else unchanged++;
  }
  return {
    rising,
    falling,
    unchanged,
    missing,
    total: sample.length,
    covered: sample.length - missing,
  };
}

export function topMovers(
  assets: MarketStatisticAsset[],
  count = 3,
  period: MarketPeriod = "24h",
) {
  const eligible = assets.filter(
    (asset) => marketChange(asset, period) !== null,
  );
  const gainers = eligible
    .filter((asset) => decimal(marketChange(asset, period)!).gt(0))
    .sort((a, b) =>
      decimal(marketChange(b, period)!).cmp(decimal(marketChange(a, period)!)),
    )
    .slice(0, count);
  const losers = eligible
    .filter((asset) => decimal(marketChange(asset, period)!).lt(0))
    .sort((a, b) =>
      decimal(marketChange(a, period)!).cmp(decimal(marketChange(b, period)!)),
    )
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
    (item) =>
      item.value.trim() !== "" &&
      item.value !== "." &&
      Number.isFinite(Number(item.value)),
  );
  return valid.length ? valid[valid.length - 1] : null;
}

// Annual comparisons use the same calendar month, even when observations are missing.
export function observationHistory(
  observations: { date: string; value: string }[],
  transform?: "yoy" | "mom",
) {
  const valid = observations
    .filter(
      (item) =>
        item.value.trim() !== "" &&
        item.value !== "." &&
        Number.isFinite(Number(item.value)),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!transform) return valid;
  const months = new Map(
    valid.map((item) => [item.date.slice(0, 7), item.value]),
  );
  return valid.flatMap((item) => {
    const [year, month] = item.date.split("-").map(Number);
    const prior = new Date(
      Date.UTC(year, month - 1 - (transform === "yoy" ? 12 : 1), 1),
    );
    const base = months.get(prior.toISOString().slice(0, 7));
    const value =
      base === undefined ? null : percentageChange(item.value, base);
    return value === null ? [] : [{ date: item.date, value }];
  });
}
