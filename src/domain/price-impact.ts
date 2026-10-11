import { amount, decimal } from "./decimal";
import { positionStatistics } from "./portfolio-statistics";
import { isInvestableCrypto } from "./portfolio-segments";
import type { PortfolioSummary, ValuedPosition } from "./types";

export type PriceImpactRow = {
  position: ValuedPosition;
  change: string;
  impact: string;
};

export type PriceImpact = {
  gainers: PriceImpactRow[];
  losers: PriceImpactRow[];
  knownImpact: string | null;
  covered: number;
  total: number;
  missing: number;
};

function priceImpact(position: ValuedPosition): PriceImpactRow | null {
  const quote = position.quote;
  if (
    !quote ||
    quote.stale ||
    quote.change24h === null ||
    !decimal(position.quantity).gt(0) ||
    !decimal(quote.price).gt(0)
  ) {
    return null;
  }
  const change = decimal(quote.change24h);
  const impact = positionStatistics(position).dayImpact;
  if (impact === null) return null;
  return {
    position,
    change: amount(change),
    impact,
  };
}

/**
 * Estimates the current holdings' 24-hour price effect. It intentionally does
 * not represent realised performance or account for intraday transactions.
 */
export function portfolioPriceImpact(summary: PortfolioSummary): PriceImpact {
  const positions = summary.positions.filter(
    (position) =>
      decimal(position.quantity).gt(0) && isInvestableCrypto(position.asset),
  );
  const rows = positions.flatMap((position) => {
    try {
      const row = priceImpact(position);
      return row ? [row] : [];
    } catch {
      return [];
    }
  });
  const knownImpact = rows.length
    ? amount(rows.reduce((total, row) => total.plus(row.impact), decimal(0)))
    : null;
  return {
    gainers: rows
      .filter((row) => decimal(row.impact).gt(0))
      .sort((a, b) => decimal(b.impact).cmp(a.impact))
      .slice(0, 3),
    losers: rows
      .filter((row) => decimal(row.impact).lt(0))
      .sort((a, b) => decimal(a.impact).cmp(b.impact))
      .slice(0, 3),
    knownImpact,
    covered: rows.length,
    total: positions.length,
    missing: positions.length - rows.length,
  };
}
