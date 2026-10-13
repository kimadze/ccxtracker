import { amount, decimal } from "./decimal";
import { analyzePerformance } from "./analytics";
import type { LedgerEntry, PortfolioSummary } from "./types";

export interface DailyChange {
  amount: string | null;
  percent: string | null;
  from: string | null;
  reason: string | null;
}
export function dailyChange(
  summary: PortfolioSummary,
  baseline: { capturedAt: Date; value: string } | undefined,
  entries: LedgerEntry[],
  start: Date,
  now: Date,
): DailyChange {
  const unavailable = (reason: string): DailyChange => ({
    amount: null,
    percent: null,
    from: null,
    reason,
  });
  if (!summary.complete || summary.value === null)
    return unavailable("ფასები არასრულია");
  if (summary.stale) return unavailable("ფასები მოძველებულია");
  // A nearby midnight observation is required; never label a multi-day change as today's result.
  if (
    !baseline ||
    baseline.capturedAt < start ||
    baseline.capturedAt.getTime() - start.getTime() > 3600000 ||
    baseline.capturedAt >= now
  )
    return unavailable("დღის საწყისი შეფასება არ გვაქვს");
  const interval = entries.filter(
    (e) =>
      Date.parse(e.occurredAt) > baseline.capturedAt.getTime() &&
      Date.parse(e.occurredAt) <= now.getTime(),
  );
  if (
    interval.some(
      (e) =>
        e.assetId !== "USD" &&
        (e.kind === "deposit" || e.kind === "withdrawal"),
    )
  )
    return unavailable("აქტივის გადმოტანის ღირებულება უცნობია");
  const netFlow = interval
    .filter(
      (e) =>
        e.assetId === "USD" &&
        (e.kind === "deposit" || e.kind === "withdrawal"),
    )
    .reduce(
      (sum, e) =>
        sum.plus(decimal(e.quantity).mul(e.kind === "deposit" ? 1 : -1)),
      decimal(0),
    );
  const change = amount(
    decimal(summary.value).minus(baseline.value).minus(netFlow),
  );
  const performance = analyzePerformance(
    [
      {
        capturedAt: baseline.capturedAt.toISOString(),
        value: baseline.value,
        cash: "0",
        realizedPnl: null,
        unrealizedPnl: null,
      },
      {
        capturedAt: now.toISOString(),
        value: summary.value,
        cash: summary.cash,
        realizedPnl: null,
        unrealizedPnl: null,
      },
    ],
    interval,
  );
  return {
    amount: change,
    percent: performance.returnPercent,
    from: baseline.capturedAt.toISOString(),
    reason: null,
  };
}
