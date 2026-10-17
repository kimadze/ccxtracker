import { expect, it } from "vitest";
import { dailyMovers } from "@/domain/daily-movers";
import type { ValuedPosition } from "@/domain/types";

const quoteTime = new Date().toISOString();
function position(
  symbol: string,
  change24h: string | null,
  options: { stale?: boolean; quantity?: string; stable?: boolean } = {},
): ValuedPosition {
  return {
    assetId: symbol,
    quantity: options.quantity ?? "1",
    costBasis: "1",
    averagePrice: "1",
    realizedPnl: "0",
    asset: {
      id: symbol,
      symbol,
      name: symbol,
      providerId: symbol.toLowerCase(),
      isStablecoin: options.stable ?? false,
    },
    quote: {
      assetId: symbol,
      price: "1",
      change24h,
      updatedAt: quoteTime,
      stale: options.stale ?? false,
    },
    value: "1",
    unrealizedPnl: "0",
    returnPercent: "0",
    allocation: null,
  };
}

it("selects the highest positive and lowest negative fresh holding changes", () => {
  const result = dailyMovers([
    position("UP", "8.5"),
    position("DOWN", "-3.2"),
    position("MORE_DOWN", "-9.1"),
    position("FLAT", "0"),
  ]);
  expect(result.gainer?.asset.symbol).toBe("UP");
  expect(result.loser?.asset.symbol).toBe("MORE_DOWN");
  expect(result.hasFreshQuotes).toBe(true);
});

it("ignores stale, missing, stablecoin and zero-quantity positions", () => {
  const result = dailyMovers([
    position("STALE", "90", { stale: true }),
    position("UNKNOWN", null),
    position("USD", "-100", { stable: true }),
    position("EMPTY", "-70", { quantity: "0" }),
  ]);
  expect(result.gainer).toBeUndefined();
  expect(result.loser).toBeUndefined();
  expect(result.hasFreshQuotes).toBe(false);
  expect(result.hasIncompleteCoverage).toBe(true);
});

it("marks the ranking as partial when one held asset has no usable quote", () => {
  const result = dailyMovers([
    position("UP", "8.5"),
    position("MISSING", null),
  ]);
  expect(result.gainer?.asset.symbol).toBe("UP");
  expect(result.hasIncompleteCoverage).toBe(true);
  expect(result.coveredAssets).toBe(1);
  expect(result.totalAssets).toBe(2);
});
