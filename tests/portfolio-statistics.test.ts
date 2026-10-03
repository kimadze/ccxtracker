import { describe, expect, it } from "vitest";
import {
  positionStatistics,
  portfolioStatistics,
} from "../src/domain/portfolio-statistics";
import type { PortfolioSummary, ValuedPosition } from "../src/domain/types";

const position: ValuedPosition = {
  assetId: "btc",
  asset: {
    id: "btc",
    symbol: "BTC",
    name: "Bitcoin",
    providerId: "bitcoin",
    isStablecoin: false,
  },
  quantity: "2",
  costBasis: "400",
  averagePrice: "200",
  realizedPnl: "0",
  value: "220",
  unrealizedPnl: "-180",
  returnPercent: "-45",
  allocation: "100",
  quote: {
    assetId: "btc",
    price: "110",
    change24h: "10",
    updatedAt: "2026-10-03T00:00:00Z",
    stale: false,
  },
};
describe("portfolio working statistics", () => {
  it("reconstructs prior price rather than multiplying current value by daily percent", () => {
    expect(positionStatistics(position).dayImpact).toBe("20");
    expect(
      positionStatistics({
        ...position,
        quote: { ...position.quote!, price: "50", change24h: "-50" },
        averagePrice: "100",
      }),
    ).toMatchObject({ dayImpact: "-100", recovery: "100" });
  });
  it("does not manufacture values for stale, missing or unreconstructable quotes", () => {
    expect(
      positionStatistics({
        ...position,
        quote: { ...position.quote!, stale: true },
      }).dayImpact,
    ).toBeNull();
    expect(positionStatistics({ ...position, quote: null })).toMatchObject({
      dayImpact: null,
      recovery: null,
    });
    expect(
      positionStatistics({
        ...position,
        quote: { ...position.quote!, change24h: "-100" },
      }).dayImpact,
    ).toBeNull();
    expect(
      positionStatistics({
        ...position,
        quote: { ...position.quote!, price: "0" },
      }).recovery,
    ).toBeNull();
  });
  it("has no recovery requirement above cost and preserves unknown cost", () => {
    expect(
      positionStatistics({ ...position, averagePrice: "100" }).recovery,
    ).toBe("0");
    expect(
      positionStatistics({ ...position, averagePrice: null }).recovery,
    ).toBeNull();
  });
  it("excludes liquidity and refuses partial aggregate or allocation", () => {
    const summary = {
      positions: [
        position,
        {
          ...position,
          assetId: "usdt",
          asset: { ...position.asset, isStablecoin: true },
        },
        { ...position, assetId: "unknown", quote: null, value: null },
      ],
    } as PortfolioSummary;
    const result = portfolioStatistics(summary);
    expect(result).toMatchObject({ total: 2, covered: 1, impact: null });
    expect(result.rows.every((row) => row.cryptoShare === null)).toBe(true);
    expect(
      portfolioStatistics({ ...summary, positions: [position] }),
    ).toMatchObject({ total: 1, impact: "20" });
  });
});
