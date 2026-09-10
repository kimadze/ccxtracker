import { describe, expect, it } from "vitest";
import { calculatePortfolioAttribution } from "@/domain/attribution";
import { replayLedger } from "@/domain/ledger";
import { valuePortfolio } from "@/domain/valuation";
import type { Asset, LedgerEntry, Quote } from "@/domain/types";

const assets: Asset[] = [
  {
    id: "btc",
    symbol: "BTC",
    name: "Bitcoin",
    providerId: "bitcoin",
    isStablecoin: false,
    category: "store-of-value",
  },
  {
    id: "eth",
    symbol: "ETH",
    name: "Ethereum",
    providerId: "ethereum",
    isStablecoin: false,
    category: "layer-1",
  },
  {
    id: "sol",
    symbol: "SOL",
    name: "Solana",
    providerId: "solana",
    isStablecoin: false,
    category: "layer-1",
  },
];
const entry = (
  sequence: number,
  kind: LedgerEntry["kind"],
  assetId: string,
  quantity: string,
  price: string | null = null,
  fee = "0",
): LedgerEntry => ({
  id: String(sequence),
  sequence,
  kind,
  assetId,
  quantity,
  price,
  fee,
  occurredAt: `2026-01-${String(sequence + 1).padStart(2, "0")}T00:00:00Z`,
});
const fund = (quantity = "10000") => entry(0, "deposit", "USD", quantity);
const quote = (assetId: string, price: string): Quote => ({
  assetId,
  price,
  change24h: null,
  updatedAt: "2026-02-01T00:00:00Z",
  stale: false,
});
function attribution(entries: LedgerEntry[], quotes: Quote[]) {
  const ledger = replayLedger(entries);
  const summary = valuePortfolio(ledger, assets, quotes);
  return {
    result: calculatePortfolioAttribution(ledger, summary, assets),
    summary,
  };
}

describe("all-time performance attribution", () => {
  it("attributes one profitable asset and excludes external deposits and withdrawals", () => {
    const { result } = attribution(
      [
        fund(),
        entry(1, "buy", "btc", "1", "100"),
        entry(2, "withdrawal", "USD", "1000"),
      ],
      [quote("btc", "150")],
    );
    expect(result.totalPnl).toBe("50");
    expect(result.assets[0]).toMatchObject({
      symbol: "BTC",
      unrealizedPnl: "50",
      realizedPnl: "0",
      totalPnl: "50",
      contributionPercent: "100",
    });
    expect(result.reconciled).toBe(true);
  });

  it("ranks mixed contributors and handles a total portfolio loss semantically", () => {
    const { result } = attribution(
      [
        fund(),
        entry(1, "buy", "btc", "1", "100"),
        entry(2, "buy", "eth", "2", "100"),
        entry(3, "buy", "sol", "1", "100"),
      ],
      [quote("btc", "150"), quote("eth", "50"), quote("sol", "70")],
    );
    expect(result.totalPnl).toBe("-80");
    expect(result.topPositive?.symbol).toBe("BTC");
    expect(result.topNegative?.symbol).toBe("ETH");
    expect(result.assets.map((row) => row.totalPnl)).toEqual([
      "50",
      "-30",
      "-100",
    ]);
    expect(
      result.assets.reduce(
        (sum, row) => sum + Number(row.contributionPercent),
        0,
      ),
    ).toBeCloseTo(100);
  });

  it("separates realized and unrealized P&L for a partially sold position", () => {
    const { result } = attribution(
      [
        fund(),
        entry(1, "buy", "btc", "2", "100"),
        entry(2, "sell", "btc", "1", "150"),
      ],
      [quote("btc", "125")],
    );
    expect(result.assets[0]).toMatchObject({
      realizedPnl: "50",
      unrealizedPnl: "25",
      totalPnl: "75",
    });
    expect(result.totalPnl).toBe("75");
  });

  it("keeps a fully closed realized-only asset in attribution", () => {
    const { result } = attribution(
      [
        fund(),
        entry(1, "buy", "btc", "1", "100"),
        entry(2, "sell", "btc", "1", "160"),
      ],
      [],
    );
    expect(result.assets[0]).toMatchObject({
      symbol: "BTC",
      currentValue: "0",
      realizedPnl: "60",
      unrealizedPnl: "0",
      totalPnl: "60",
      returnPercent: null,
    });
  });

  it("reconciles USD fees without assigning deposits as asset profit", () => {
    const { result, summary } = attribution(
      [fund("1000"), entry(1, "fee", "USD", "10")],
      [],
    );
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0]).toMatchObject({ isFee: true, totalPnl: "-10" });
    expect(result.totalPnl).toBe(summary.totalPnl);
  });

  it("aggregates categories from underlying assets and reconciles both levels", () => {
    const { result } = attribution(
      [
        fund(),
        entry(1, "buy", "eth", "1", "100"),
        entry(2, "buy", "sol", "2", "100"),
      ],
      [quote("eth", "150"), quote("sol", "125")],
    );
    expect(result.totalPnl).toBe("100");
    expect(result.categories).toHaveLength(1);
    expect(result.categories[0]).toMatchObject({
      category: "layer-1",
      totalPnl: "100",
      contributionPercent: "100",
    });
    expect(result.categories[0].assets).toEqual(["ETH", "SOL"]);
    expect(
      result.categories.reduce(
        (sum, category) => sum + Number(category.totalPnl),
        0,
      ),
    ).toBe(Number(result.totalPnl));
  });

  it("omits percentages at zero total P&L and handles an empty portfolio", () => {
    const zero = attribution(
      [fund(), entry(1, "buy", "btc", "1", "100")],
      [quote("btc", "100")],
    ).result;
    expect(zero.totalPnl).toBe("0");
    expect(zero.assets[0].contributionPercent).toBeNull();
    const empty = attribution([], []).result;
    expect(empty).toMatchObject({
      totalPnl: "0",
      complete: true,
      reconciled: true,
      assetsInProfit: 0,
      assetsInLoss: 0,
    });
  });

  it("refuses unreconciled attribution when price or basis is unavailable", () => {
    const missingPrice = attribution(
      [fund(), entry(1, "buy", "btc", "1", "100")],
      [],
    ).result;
    expect(missingPrice).toMatchObject({
      totalPnl: null,
      complete: false,
      reconciled: false,
    });
    const unknownBasis = attribution(
      [entry(1, "deposit", "btc", "1")],
      [quote("btc", "150")],
    ).result;
    expect(unknownBasis).toMatchObject({
      totalPnl: null,
      complete: false,
      reconciled: false,
    });
  });
});
