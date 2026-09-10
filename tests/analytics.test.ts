import { describe, expect, it } from "vitest";
import {
  analyzeHealth,
  analyzePerformance,
  type Snapshot,
} from "@/domain/analytics";
import { demoSummary } from "@/domain/demo";
const snapshot = (day: number, value: string): Snapshot => ({
  capturedAt: `2026-01-0${day}T00:00:00Z`,
  value,
  cash: "0",
  realizedPnl: "0",
  unrealizedPnl: "0",
});
describe("performance estimates", () => {
  it("does not count funding as profit", () => {
    const result = analyzePerformance(
      [snapshot(1, "100"), snapshot(2, "200")],
      [
        {
          id: "1",
          sequence: 1,
          assetId: "USD",
          kind: "deposit",
          quantity: "100",
          price: null,
          fee: "0",
          occurredAt: "2026-01-01T12:00:00Z",
        },
      ],
    );
    expect(result.returnPercent).toBe("0");
    expect(result.maxDrawdown).toBe("0");
  });
  it("compounds return and measures peak-to-trough drawdown", () => {
    const r = analyzePerformance(
      [snapshot(1, "100"), snapshot(2, "120"), snapshot(3, "90")],
      [],
    );
    expect(r.returnPercent).toBe("-10");
    expect(r.maxDrawdown).toBe("-25");
  });
  it("suppresses undefined returns, sparse history and asset transfers without market valuations", () => {
    expect(analyzePerformance([], []).returnPercent).toBeNull();
    expect(
      analyzePerformance([snapshot(1, "0"), snapshot(2, "100")], [])
        .returnPercent,
    ).toBeNull();
    expect(
      analyzePerformance([snapshot(1, "100"), snapshot(5, "120")], [])
        .returnPercent,
    ).toBeNull();
    const entry = {
      id: "1",
      sequence: 1,
      assetId: "btc",
      kind: "deposit" as const,
      quantity: "1",
      price: "100",
      fee: "0",
      occurredAt: "2026-01-01T12:00:00Z",
    };
    expect(
      analyzePerformance([snapshot(1, "100"), snapshot(2, "200")], [entry])
        .returnPercent,
    ).toBeNull();
  });
});
describe("explainable structure indicators", () => {
  it("computes actual concentration and reserve metrics", () => {
    const r = analyzeHealth(demoSummary)!;
    expect(r.largestSymbol).toBe("BTC");
    expect(Number(r.topThree)).toBeGreaterThan(Number(r.largest));
    expect(Number(r.effectivePositions)).toBeGreaterThan(1);
  });
  it("does not score missing or stale prices", () => {
    expect(analyzeHealth({ ...demoSummary, stale: true })).toBeNull();
    expect(analyzeHealth({ ...demoSummary, complete: false })).toBeNull();
  });
});
