import { describe, expect, it } from "vitest";
import { calculateScenario, goalProgress } from "@/domain/scenarios";
import { demoSummary } from "@/domain/demo";
describe("shared scenario engine", () => {
  it("uses current holdings, unchanged cash and explicit current-price fallback", () => {
    const base = calculateScenario(demoSummary, {});
    expect(base.value).toBe(demoSummary.value);
    expect(base.growth).toBe("0");
    const r = calculateScenario(demoSummary, { bitcoin: "197420" });
    expect(Number(r.growth)).toBe(24000);
    expect(r.positions[0].assumedCurrentPrice).toBe(false);
    expect(r.positions[1].assumedCurrentPrice).toBe(true);
  });
  it("models a complete loss and rejects negative target prices", () => {
    expect(
      calculateScenario(demoSummary, { bitcoin: "0" }).positions[0].value,
    ).toBe("0");
    expect(() => calculateScenario(demoSummary, { bitcoin: "-1" })).toThrow();
  });
  it("does not invent unavailable valuations", () => {
    const missing = {
      ...demoSummary,
      positions: demoSummary.positions.map((p) => ({ ...p, quote: null })),
    };
    expect(calculateScenario(missing, {}).value).toBeNull();
  });
});
describe("goals", () => {
  it("computes progress, gap and required growth", () => {
    expect(goalProgress("25000", "100000")).toEqual({
      progress: "25",
      gap: "75000",
      requiredGrowth: "300",
    });
  });
  it("caps achieved goals and handles empty and unavailable portfolios", () => {
    expect(goalProgress("120000", "100000").gap).toBe("0");
    expect(goalProgress("120000", "100000").progress).toBe("100");
    expect(goalProgress("0", "100000").requiredGrowth).toBeNull();
    expect(goalProgress(null, "100000").progress).toBeNull();
    expect(() => goalProgress("1", "0")).toThrow();
  });
});
