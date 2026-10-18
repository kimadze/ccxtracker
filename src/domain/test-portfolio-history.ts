import Decimal from "decimal.js";

// Presentation-only fixture. Never persist these points as financial snapshots.
export const TEST_HISTORY_PORTFOLIO_ID = "f3365b18-f450-4107-a10b-eb7dc1d314e5";

export function testPortfolioHistory(
  portfolioId: string,
  currentValue: string,
  now: number = Date.now(),
) {
  if (portfolioId !== TEST_HISTORY_PORTFOLIO_ID) return null;
  const value = new Decimal(currentValue);
  if (!value.isFinite() || value.isNegative()) return null;
  const hour = 3_600_000;
  const end = Math.floor(now / hour) * hour;
  const start = end - 366 * 24 * hour;
  const times = new Set<number>();
  for (let time = start; time <= end; time += 24 * hour) times.add(time);
  for (let time = end - 7 * 24 * hour; time <= end; time += hour)
    times.add(time);
  const wave = (time: number) =>
    Math.sin(time / hour / 29) * 0.045 +
    Math.sin(time / hour / 113) * 0.07 +
    Math.sin(time / hour / 7) * 0.012;
  return [...times]
    .sort((a, b) => a - b)
    .map((time) => {
      const progress = (time - start) / (end - start);
      const factor = 0.68 + progress * 0.32 + wave(time) - wave(end);
      return {
        capturedAt: new Date(time).toISOString(),
        value: time === end ? value.toFixed(2) : value.mul(factor).toFixed(2),
      };
    });
}
