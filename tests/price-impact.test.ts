import { describe, expect, it } from "vitest";
import { portfolioPriceImpact } from "@/domain/price-impact";
import type { PortfolioSummary, ValuedPosition } from "@/domain/types";

function position(
  id: string,
  price: string,
  change: string | null,
  quantity = "1",
): ValuedPosition {
  return {
    assetId: id,
    asset: { id, symbol: id, name: id, providerId: id, isStablecoin: false },
    quantity,
    costBasis: null,
    averagePrice: null,
    realizedPnl: null,
    value: null,
    unrealizedPnl: null,
    returnPercent: null,
    allocation: null,
    quote: {
      assetId: id,
      price,
      change24h: change,
      stale: false,
      updatedAt: new Date().toISOString(),
    },
  };
}
const impact = (...positions: ValuedPosition[]) =>
  portfolioPriceImpact({ positions } as PortfolioSummary);

describe("held asset price impact", () => {
  it("uses previous price and ranks by USD effect instead of percentage", () => {
    const result = impact(
      position("large", "110", "10", "100"),
      position("tiny", "2", "100"),
      position("loss", "50", "-50", "2"),
    );
    expect(result.gainers.map((r) => [r.position.assetId, r.impact])).toEqual([
      ["large", "1000"],
      ["tiny", "1"],
    ]);
    expect(result.losers[0].impact).toBe("-100");
    expect(result.knownImpact).toBe("901");
  });
  it("counts a flat quote as covered without inventing a mover", () => {
    expect(impact(position("flat", "10", "0"))).toMatchObject({
      knownImpact: "0",
      covered: 1,
      gainers: [],
      losers: [],
    });
  });
  it("keeps unknown and stale prices outside the known partial total", () => {
    const stale = position("stale", "10", "5");
    stale.quote!.stale = true;
    const missing = position("missing", "10", null);
    const noQuote = { ...missing, assetId: "noQuote", quote: null };
    expect(
      impact(
        position("known", "110", "10"),
        stale,
        missing,
        noQuote,
        position("invalid", "1", "-100"),
      ),
    ).toMatchObject({ knownImpact: "10", covered: 1, total: 5, missing: 4 });
    expect(impact(stale, missing).knownImpact).toBeNull();
  });
  it("excludes cash, stablecoins and closed positions", () => {
    const stable = position("USDT", "1", "10");
    stable.asset.isStablecoin = true;
    const cash = position("USD", "1", "10");
    cash.asset.category = "cash";
    expect(
      impact(stable, cash, position("closed", "1", "10", "0")),
    ).toMatchObject({ total: 0, knownImpact: null });
  });
});
