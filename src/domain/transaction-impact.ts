import { replayLedger } from "./ledger";
import { valuePortfolio } from "./valuation";
import type { Asset, LedgerEntry, Quote } from "./types";

export function transactionImpact(
  before: LedgerEntry[],
  after: LedgerEntry[],
  assets: Asset[],
  quotes: Quote[],
  changedAssets: string[],
) {
  const oldLedger = replayLedger(before),
    newLedger = replayLedger(after);
  const oldValue = valuePortfolio(oldLedger, assets, quotes),
    newValue = valuePortfolio(newLedger, assets, quotes);
  return {
    cash: { before: oldLedger.cash, after: newLedger.cash },
    pnl: { before: oldValue.totalPnl, after: newValue.totalPnl },
    complete: oldValue.complete && newValue.complete,
    stale: oldValue.stale || newValue.stale,
    assets: [...new Set(changedAssets)]
      .filter((id) => id !== "USD")
      .map((id) => {
        const old = oldLedger.holdings.find((h) => h.assetId === id),
          next = newLedger.holdings.find((h) => h.assetId === id);
        return {
          id,
          symbol: assets.find((a) => a.id === id)?.symbol ?? id,
          quantity: {
            before: old?.quantity ?? "0",
            after: next?.quantity ?? "0",
          },
          basis: {
            before: old ? old.costBasis : "0",
            after: next ? next.costBasis : "0",
          },
        };
      }),
  };
}
export type TransactionImpact = ReturnType<typeof transactionImpact>;
