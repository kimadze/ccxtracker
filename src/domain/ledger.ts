import { D, amount, decimal } from "./decimal";
import type { LedgerEntry, LedgerResult } from "./types";

export class LedgerError extends Error {
  constructor(
    public code:
      "INSUFFICIENT_CASH" | "INSUFFICIENT_HOLDINGS" | "INVALID_TRANSACTION",
  ) {
    super(code);
  }
}
interface State {
  quantity: InstanceType<typeof D>;
  basis: InstanceType<typeof D> | null;
  realized: InstanceType<typeof D> | null;
}

/** Replay the complete ledger so backdated edits are checked against every later balance. */
export function replayLedger(entries: LedgerEntry[]): LedgerResult {
  let cash = new D(0),
    contributions = new D(0),
    withdrawals = new D(0),
    cashFees = new D(0);
  let unknownContributions = false,
    unknownWithdrawals = false;
  const states = new Map<string, State>();
  const sorted = [...entries].sort(
    (a, b) =>
      Date.parse(a.occurredAt) - Date.parse(b.occurredAt) ||
      a.sequence - b.sequence ||
      a.id.localeCompare(b.id),
  );
  for (const entry of sorted) {
    const q = decimal(entry.quantity),
      fee = decimal(entry.fee),
      price = entry.price === null ? null : decimal(entry.price);
    if (
      q.lte(0) ||
      fee.lt(0) ||
      (price && price.lt(0)) ||
      !Number.isFinite(Date.parse(entry.occurredAt))
    )
      throw new LedgerError("INVALID_TRANSACTION");
    if (entry.assetId === "USD") {
      if (entry.kind === "deposit") {
        cash = cash.plus(q);
        contributions = contributions.plus(q);
      } else if (entry.kind === "withdrawal") {
        cash = cash.minus(q);
        withdrawals = withdrawals.plus(q);
      } else if (entry.kind === "fee") {
        cash = cash.minus(q);
        cashFees = cashFees.plus(q);
      } else throw new LedgerError("INVALID_TRANSACTION");
      cash = cash.minus(fee);
      cashFees = cashFees.plus(fee);
    } else {
      const s = states.get(entry.assetId) ?? {
        quantity: new D(0),
        basis: new D(0),
        realized: new D(0),
      };
      if (entry.kind === "buy" || entry.kind === "deposit") {
        if (entry.kind === "buy" && (!price || price.lte(0)))
          throw new LedgerError("INVALID_TRANSACTION");
        const basis = price?.mul(q) ?? null;
        if (entry.kind === "buy") cash = cash.minus(basis!).minus(fee);
        else {
          if (basis === null) unknownContributions = true;
          contributions = contributions.plus(basis ?? 0);
          cash = cash.minus(fee);
        }
        s.basis =
          s.basis === null || basis === null
            ? null
            : s.basis.plus(basis).plus(fee);
        s.quantity = s.quantity.plus(q);
      } else {
        if (q.gt(s.quantity)) throw new LedgerError("INSUFFICIENT_HOLDINGS");
        const removedBasis = s.basis?.mul(q).div(s.quantity) ?? null;
        if (entry.kind === "sell") {
          if (!price || price.lte(0) || fee.gt(q.mul(price)))
            throw new LedgerError("INVALID_TRANSACTION");
          const proceeds = q.mul(price).minus(fee);
          cash = cash.plus(proceeds);
          s.realized =
            s.realized === null || removedBasis === null
              ? null
              : s.realized.plus(proceeds).minus(removedBasis);
        } else if (entry.kind === "withdrawal") {
          if (removedBasis === null) unknownWithdrawals = true;
          withdrawals = withdrawals.plus(removedBasis ?? 0);
          cash = cash.minus(fee);
          cashFees = cashFees.plus(fee);
        } else if (entry.kind === "fee") {
          s.realized =
            s.realized === null || removedBasis === null
              ? null
              : s.realized.minus(removedBasis);
          cash = cash.minus(fee);
          cashFees = cashFees.plus(fee);
        } else throw new LedgerError("INVALID_TRANSACTION");
        s.quantity = s.quantity.minus(q);
        s.basis = s.quantity.isZero()
          ? new D(0)
          : s.basis === null || removedBasis === null
            ? null
            : s.basis.minus(removedBasis);
      }
      states.set(entry.assetId, s);
    }
    if (cash.lt(0)) throw new LedgerError("INSUFFICIENT_CASH");
  }
  const holdings = [...states].map(([assetId, s]) => ({
    assetId,
    quantity: amount(s.quantity),
    costBasis: s.basis === null ? null : amount(s.basis),
    averagePrice:
      s.quantity.isZero() || s.basis === null
        ? null
        : amount(s.basis.div(s.quantity)),
    realizedPnl: s.realized === null ? null : amount(s.realized),
  }));
  const realized = holdings.some((h) => h.realizedPnl === null)
    ? null
    : amount(
        holdings
          .reduce((sum, h) => sum.plus(h.realizedPnl!), new D(0))
          .minus(cashFees),
      );
  return {
    holdings,
    cash: amount(cash),
    contributions: unknownContributions ? null : amount(contributions),
    withdrawals: unknownWithdrawals ? null : amount(withdrawals),
    cashFees: amount(cashFees),
    realizedPnl: realized,
  };
}
