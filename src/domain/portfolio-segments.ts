import { D, amount, decimal, percent } from "./decimal";
import type { Asset, PortfolioSummary, ValuedPosition } from "./types";

/** Assets with market risk; cash and stablecoins are tracked as liquidity only. */
export function isInvestableCrypto(asset: Asset) {
  return !asset.isStablecoin && asset.category !== "cash" && asset.id !== "USD";
}

export function investablePositions(summary: PortfolioSummary): ValuedPosition[] {
  return summary.positions.filter((position) => isInvestableCrypto(position.asset));
}

export function investableValue(summary: PortfolioSummary): string | null {
  const positions = investablePositions(summary);
  if (positions.some((position) => position.value === null)) return null;
  return amount(positions.reduce((sum, position) => sum.plus(position.value ?? 0), new D(0)));
}

export function investableCostBasis(summary: PortfolioSummary): string | null {
  const positions = investablePositions(summary);
  if (positions.some((position) => position.costBasis === null)) return null;
  return amount(positions.reduce((sum, position) => sum.plus(position.costBasis ?? 0), new D(0)));
}

export function investableAllocation(value: string | null, total: string | null) {
  return value === null || total === null || decimal(total).lte(0) ? null : percent(value, total);
}
