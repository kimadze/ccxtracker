import { decimal } from "./decimal";
import { isInvestableCrypto } from "./portfolio-segments";
import type { ValuedPosition } from "./types";

export function dailyMovers(positions: ValuedPosition[]) {
  const holdings = positions.filter(
    (position) =>
      isInvestableCrypto(position.asset) && decimal(position.quantity).gt(0),
  );
  const eligible = holdings.filter((position) => {
    const quote = position.quote;
    if (!position.value || !quote || quote.stale || quote.change24h === null)
      return false;

    const observedAt = Date.parse(quote.updatedAt);
    return Number.isFinite(observedAt) && observedAt <= Date.now();
  });

  const sorted = [...eligible].sort((a, b) =>
    decimal(b.quote!.change24h!).cmp(a.quote!.change24h!),
  );
  const latestQuoteAt = eligible
    .map((position) => position.quote!.updatedAt)
    .sort()
    .at(-1);

  return {
    gainer: sorted.find((position) =>
      decimal(position.quote!.change24h!).gt(0),
    ),
    loser: sorted
      .filter((position) => decimal(position.quote!.change24h!).lt(0))
      .at(-1),
    latestQuoteAt: latestQuoteAt ?? null,
    hasFreshQuotes: eligible.length > 0,
    hasIncompleteCoverage: eligible.length < holdings.length,
    coveredAssets: eligible.length,
    totalAssets: holdings.length,
  };
}
