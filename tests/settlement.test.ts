import { describe, expect, it } from "vitest";
import { replayLedger, saleResults } from "@/domain/ledger";
import { valuePortfolio } from "@/domain/valuation";
import { transactionSchema } from "@/domain/validation";
import type { Asset, LedgerEntry } from "@/domain/types";

const opening: LedgerEntry = {
  id: "opening",
  assetId: "strk",
  kind: "deposit",
  quantity: "1000",
  price: "0.1",
  fee: "0",
  occurredAt: "2026-01-01T00:00:00Z",
  sequence: 1,
};
const sale: LedgerEntry = {
  ...opening,
  id: "sale",
  kind: "sell",
  quantity: "526.05",
  price: "0.11565",
  settlementAssetId: "tether",
  settlementRate: "1",
  sequence: 2,
};
const assets: Asset[] = [
  {
    id: "strk",
    symbol: "STRK",
    name: "Starknet",
    providerId: "starknet",
    isStablecoin: false,
  },
  {
    id: "tether",
    symbol: "USDT",
    name: "Tether",
    providerId: "tether",
    isStablecoin: true,
  },
  {
    id: "usd-coin",
    symbol: "USDC",
    name: "USDC",
    providerId: "usd-coin",
    isStablecoin: true,
  },
];
const value = (entries: LedgerEntry[], stablePrice = "1") =>
  valuePortfolio(
    replayLedger(entries),
    assets,
    assets.map((a) => ({
      assetId: a.id,
      price: a.id === "strk" ? "0.11565" : stablePrice,
      change24h: null,
      updatedAt: "2026-01-01T00:00:00Z",
      stale: false,
    })),
  );
describe("two-leg stablecoin settlement", () => {
  it("sells with no cash, credits exact USDT proceeds, keeps capital and counts value once", () => {
    const result = replayLedger([opening, sale]);
    expect(result.cash).toBe("0");
    expect(result.contributions).toBe("100");
    expect(result.holdings.find((h) => h.assetId === "tether")).toMatchObject({
      quantity: "60.8376825",
      costBasis: "60.8376825",
    });
    expect(saleResults([opening, sale]).sale).toMatchObject({
      realizedPnl: "8.2326825",
    });
    expect(value([opening, sale])).toMatchObject({
      value: "115.65",
      totalPnl: "15.65",
      stablecoinValue: "60.8376825",
    });
  });
  it("deducts fees in settlement units and stores historical USD basis with a different rate", () => {
    const result = replayLedger([
      opening,
      { ...sale, fee: "0.5", settlementRate: "0.98" },
    ]);
    expect(result.holdings.find((h) => h.assetId === "tether")).toMatchObject({
      quantity: "60.3376825",
      costBasis: "59.13092885",
    });
    expect(result.realizedPnl).toBe("6.52592885");
    expect(result.contributions).toBe("100");
  });
  it("buys with stablecoin, recognizes its historical basis difference, never spends USD instead", () => {
    const stable: LedgerEntry = {
      ...opening,
      assetId: "tether",
      quantity: "100",
      price: "0.9",
    };
    const buy: LedgerEntry = {
      ...sale,
      kind: "buy",
      quantity: "100",
      price: "0.5",
      fee: "1",
    };
    const result = replayLedger([stable, buy]);
    expect(result.holdings.find((h) => h.assetId === "tether")).toMatchObject({
      quantity: "49",
      costBasis: "44.1",
      realizedPnl: "5.1",
    });
    expect(result.holdings.find((h) => h.assetId === "strk")).toMatchObject({
      quantity: "100",
      costBasis: "51",
    });
    expect(result.cash).toBe("0");
    expect(() =>
      replayLedger([
        { ...opening, assetId: "USD", quantity: "1000", price: null },
        buy,
      ]),
    ).toThrow("INSUFFICIENT_SETTLEMENT");
  });
  it("values depeg with current quote and marks missing stablecoin quotes incomplete", () => {
    expect(value([opening, sale], "0.9").stablecoinValue).toBe("54.75391425");
    const summary = valuePortfolio(replayLedger([opening, sale]), assets, [
      {
        assetId: "strk",
        price: "0.11565",
        change24h: null,
        updatedAt: "2026-01-01T00:00:00Z",
        stale: false,
      },
    ]);
    expect(summary.complete).toBe(false);
    expect(summary.stablecoinValue).toBeNull();
  });
  it("replays edits, deletion and restoration of both legs; rejects removing spent proceeds", () => {
    expect(
      replayLedger([opening]).holdings.some((h) => h.assetId === "tether"),
    ).toBe(false);
    expect(replayLedger([opening, sale])).toEqual(
      replayLedger([sale, opening]),
    );
    expect(
      replayLedger([
        opening,
        { ...sale, settlementAssetId: "usd-coin" },
      ]).holdings.find((h) => h.assetId === "usd-coin")?.quantity,
    ).toBe("60.8376825");
    const buy: LedgerEntry = {
      ...sale,
      id: "buy",
      kind: "buy",
      quantity: "10",
      price: "1",
      sequence: 3,
    };
    expect(() => replayLedger([opening, buy])).toThrow(
      "INSUFFICIENT_SETTLEMENT",
    );
    expect(replayLedger([opening, sale, buy]).cash).toBe("0");
  });
  it("preserves legacy USD entries and rejects self-settlement/invalid rates", () => {
    const legacy = {
      ...sale,
      settlementAssetId: undefined,
      settlementRate: undefined,
    };
    expect(replayLedger([opening, legacy]).cash).toBe("60.8376825");
    expect(() =>
      replayLedger([opening, { ...sale, settlementAssetId: "strk" }]),
    ).toThrow("INVALID_TRANSACTION");
    expect(() =>
      replayLedger([opening, { ...sale, settlementRate: "0" }]),
    ).toThrow("INVALID_TRANSACTION");
    const input = {
      ...legacy,
      id: crypto.randomUUID(),
      portfolioId: crypto.randomUUID(),
      notes: "",
    };
    expect(transactionSchema.parse(input)).toMatchObject({
      settlementAssetId: "USD",
      settlementRate: "1",
    });
  });
});
