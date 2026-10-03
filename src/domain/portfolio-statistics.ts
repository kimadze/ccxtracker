import { D, amount, decimal, percent } from "./decimal";
import { isInvestableCrypto } from "./portfolio-segments";
import type { PortfolioSummary, ValuedPosition } from "./types";

export function positionStatistics(position: ValuedPosition) {
  const quote = position.quote;
  const price = quote ? decimal(quote.price) : null;
  const change = quote?.change24h == null ? null : decimal(quote.change24h);
  // Reconstruct the previous market price. This is the price effect on today's
  // quantity, not actual daily P/L (which requires historical holdings/flows).
  const dayImpact =
    price && change && !quote?.stale && price.gt(0) && change.gt(-100)
      ? amount(
          price
            .minus(price.div(change.div(100).plus(1)))
            .mul(position.quantity),
        )
      : null;
  const recovery =
    price && price.gt(0) && position.averagePrice !== null
      ? amount(
          D.max(0, decimal(position.averagePrice).div(price).minus(1).mul(100)),
        )
      : null;
  return { position, dayImpact, recovery };
}

export function portfolioStatistics(summary: PortfolioSummary) {
  const rows = summary.positions
    .filter((p) => isInvestableCrypto(p.asset) && decimal(p.quantity).gt(0))
    .map(positionStatistics);
  const covered = rows.filter((row) => row.dayImpact !== null);
  const impact =
    rows.length && covered.length === rows.length
      ? amount(
          covered.reduce(
            (total, row) => total.plus(row.dayImpact!),
            decimal(0),
          ),
        )
      : null;
  const valued = rows.filter((row) => row.position.value !== null);
  const cryptoValue = valued.reduce(
    (total, row) => total.plus(row.position.value!),
    decimal(0),
  );
  return {
    rows: rows.map((row) => ({
      ...row,
      cryptoShare:
        valued.length === rows.length
          ? percent(row.position.value ?? 0, cryptoValue)
          : null,
    })),
    impact,
    covered: covered.length,
    total: rows.length,
  };
}
