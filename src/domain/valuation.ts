import { D, amount, decimal, percent } from "./decimal";
import type { Asset, LedgerResult, PortfolioSummary, Quote } from "./types";

export function valuePortfolio(
  ledger: LedgerResult,
  assets: Asset[],
  quotes: Quote[],
): PortfolioSummary {
  const positions = ledger.holdings
    .filter((h) => decimal(h.quantity).gt(0))
    .map((h) => {
      const asset = assets.find((a) => a.id === h.assetId);
      if (!asset) throw new Error("UNKNOWN_ASSET");
      const quote = quotes.find((q) => q.assetId === h.assetId) ?? null;
      const value = quote ? amount(decimal(h.quantity).mul(quote.price)) : null;
      const unrealizedPnl =
        value === null || h.costBasis === null
          ? null
          : amount(decimal(value).minus(h.costBasis));
      return {
        ...h,
        asset,
        quote,
        value,
        unrealizedPnl,
        returnPercent:
          unrealizedPnl === null || h.costBasis === null
            ? null
            : percent(unrealizedPnl, h.costBasis),
        allocation: null as string | null,
      };
    });
  const complete = positions.every((p) => p.value !== null);
  const knownValue = amount(
    positions.reduce((s, p) => s.plus(p.value ?? 0), new D(ledger.cash)),
  );
  const value = complete ? knownValue : null;
  for (const p of positions)
    p.allocation =
      value === null || p.value === null ? null : percent(p.value, value);
  const costBasis = positions.some((p) => p.costBasis === null)
    ? null
    : amount(positions.reduce((s, p) => s.plus(p.costBasis!), new D(0)));
  const unrealizedPnl =
    !complete || costBasis === null
      ? null
      : amount(decimal(knownValue).minus(ledger.cash).minus(costBasis));
  const stablecoinPositions = positions.filter((p) => p.asset.isStablecoin);
  const stablecoinValue = stablecoinPositions.some((p) => p.value === null)
    ? null
    : amount(
        stablecoinPositions.reduce(
          (sum, position) => sum.plus(position.value ?? 0),
          new D(0),
        ),
      );
  const liquidity =
    stablecoinValue === null
      ? null
      : amount(decimal(ledger.cash).plus(stablecoinValue));
  return {
    positions,
    cash: ledger.cash,
    value,
    knownValue,
    costBasis,
    realizedPnl: ledger.realizedPnl,
    unrealizedPnl,
    totalPnl:
      unrealizedPnl === null || ledger.realizedPnl === null
        ? null
        : amount(decimal(unrealizedPnl).plus(ledger.realizedPnl)),
    contributions: ledger.contributions,
    withdrawals: ledger.withdrawals,
    stablecoinValue,
    liquidity,
    reserve: liquidity ?? ledger.cash,
    complete,
    stale: positions.some((p) => p.quote?.stale),
  };
}
