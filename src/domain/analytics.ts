import { D, amount, decimal, percent } from "./decimal";
import type { LedgerEntry, PortfolioSummary } from "./types";

export interface Snapshot { capturedAt: string; value: string; cash: string; realizedPnl: string | null; unrealizedPnl: string | null }
export function analyzeHealth(summary: PortfolioSummary) {
  if (!summary.complete || summary.stale || !summary.value || decimal(summary.value).lte(0)) return null;
  const sorted = [...summary.positions].sort((a, b) => decimal(b.value ?? "0").cmp(a.value ?? "0"));
  const largest = sorted[0]?.allocation ?? "0";
  const topThree = amount(sorted.slice(0, 3).reduce((s, p) => s.plus(p.allocation ?? 0), new D(0)));
  const reserve = percent(summary.reserve, summary.value) ?? "0";
  const hhi = sorted.reduce((s, p) => s.plus(decimal(p.allocation ?? 0).div(100).pow(2)), decimal(summary.cash).div(summary.value).pow(2));
  const effectivePositions = hhi.isZero() ? "0" : amount(new D(1).div(hhi));
  const concentration = decimal(largest).gte(50) ? "high" : decimal(largest).gte(30) ? "medium" : "low";
  return { largest, topThree, reserve, effectivePositions, concentration, largestSymbol: sorted[0]?.asset.symbol ?? "USD" };
}

/** Daily valuations support Modified Dietz estimates, not exact intraday TWR. */
export function analyzePerformance(snapshots: Snapshot[], entries: LedgerEntry[]) {
  const ordered = [...snapshots].sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt));
  const series: { capturedAt: string; value: string; index: string | null }[] = [];
  let index = new D(100), peak = new D(100), maxDrawdown = new D(0), valid = ordered.length >= 2;
  for (let i = 0; i < ordered.length; i++) {
    const current = ordered[i];
    if (i) {
      const previous = ordered[i - 1], start = Date.parse(previous.capturedAt), end = Date.parse(current.capturedAt);
      const interval = entries.filter(e => Date.parse(e.occurredAt) > start && Date.parse(e.occurredAt) <= end);
      // Asset transfer market values are not acquisition basis. Suppress affected estimates.
      if (interval.some(e => e.assetId !== "USD" && (e.kind === "deposit" || e.kind === "withdrawal")) || end <= start || end - start > 48 * 3600000) valid = false;
      let flows = new D(0), weightedFlows = new D(0);
      for (const e of interval.filter(e => e.assetId === "USD" && (e.kind === "deposit" || e.kind === "withdrawal"))) {
        const flow = decimal(e.quantity).mul(e.kind === "deposit" ? 1 : -1);
        flows = flows.plus(flow); weightedFlows = weightedFlows.plus(flow.mul(end - Date.parse(e.occurredAt)).div(end - start));
      }
      const denominator = decimal(previous.value).plus(weightedFlows);
      if (denominator.lte(0)) valid = false;
      if (valid) {
        const change = decimal(current.value).minus(previous.value).minus(flows).div(denominator);
        if (change.lt(-1)) valid = false;
        else { index = index.mul(change.plus(1)); peak = D.max(peak, index); maxDrawdown = D.min(maxDrawdown, index.minus(peak).div(peak).mul(100)); }
      }
    }
    series.push({ capturedAt: current.capturedAt, value: current.value, index: valid ? amount(index) : null });
  }
  return { series, returnPercent: valid ? amount(index.minus(100)) : null, maxDrawdown: valid ? amount(maxDrawdown) : null, valid };
}
