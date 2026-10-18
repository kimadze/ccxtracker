import { describe, expect, it } from "vitest";
import {
  TEST_HISTORY_PORTFOLIO_ID,
  testPortfolioHistory,
} from "../src/domain/test-portfolio-history";
import {
  historyWindow,
  type HistoryPeriod,
} from "../src/domain/history-window";

describe("isolated test portfolio chart", () => {
  const now = Date.parse("2026-10-18T12:35:00Z");
  it("never supplies fake history for another portfolio", () => {
    expect(testPortfolioHistory("real-portfolio", "1000", now)).toBeNull();
  });
  it("ends at the current value and covers every chart period", () => {
    const points = testPortfolioHistory(
      TEST_HISTORY_PORTFOLIO_ID,
      "3249.54",
      now,
    )!;
    expect(points.at(-1)?.value).toBe("3249.54");
    expect(points.every((point) => Number(point.value) >= 0)).toBe(true);
    expect(new Set(points.map((point) => point.capturedAt)).size).toBe(
      points.length,
    );
    for (const period of [
      "1D",
      "7D",
      "1M",
      "3M",
      "1Y",
      "ALL",
    ] as HistoryPeriod[])
      expect(
        historyWindow(points, period, now, true).snapshots.length,
      ).toBeGreaterThan(2);
  });
});
