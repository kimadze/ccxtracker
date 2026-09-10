import { D, amount, decimal, percent } from "./decimal";
import type { PortfolioSummary } from "./types";
export function calculateScenario(
  summary: PortfolioSummary,
  prices: Record<string, string>,
) {
  const positions = summary.positions.map((p) => {
    const target = prices[p.assetId]?.trim()
      ? decimal(prices[p.assetId])
      : p.quote
        ? decimal(p.quote.price)
        : null;
    if (target && target.lt(0)) throw new Error("INVALID_PLAN");
    const value = target === null ? null : amount(target.mul(p.quantity));
    return {
      assetId: p.assetId,
      symbol: p.asset.symbol,
      targetPrice: target?.toFixed() ?? null,
      assumedCurrentPrice: !prices[p.assetId]?.trim(),
      value,
      contribution:
        value === null || p.value === null
          ? null
          : amount(decimal(value).minus(p.value)),
      allocation: null as string | null,
    };
  });
  const value = positions.some((p) => p.value === null)
    ? null
    : amount(positions.reduce((s, p) => s.plus(p.value!), new D(summary.cash)));
  for (const p of positions)
    p.allocation =
      value === null || p.value === null ? null : percent(p.value, value);
  const growth =
    value === null || summary.value === null
      ? null
      : amount(decimal(value).minus(summary.value));
  const unrealizedPnl =
    value === null || summary.costBasis === null
      ? null
      : amount(decimal(value).minus(summary.cash).minus(summary.costBasis));
  return {
    positions,
    value,
    growth,
    returnPercent:
      growth === null || summary.value === null
        ? null
        : percent(growth, summary.value),
    unrealizedPnl,
  };
}
export function goalProgress(current: string | null, target: string) {
  const goal = decimal(target);
  if (goal.lte(0)) throw new Error("INVALID_PLAN");
  if (current === null)
    return { progress: null, gap: null, requiredGrowth: null };
  const value = decimal(current);
  if (value.lt(0)) throw new Error("INVALID_PLAN");
  return {
    progress: amount(D.min(100, value.div(goal).mul(100))),
    gap: amount(D.max(0, goal.minus(value))),
    requiredGrowth: value.isZero()
      ? null
      : amount(D.max(0, goal.minus(value)).div(value).mul(100)),
  };
}
