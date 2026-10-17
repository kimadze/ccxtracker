import { describe, expect, it } from "vitest";
import {
  calculateScenario,
  goalProgress,
  scenarioPercentagePrices,
} from "@/domain/scenarios";
import { amountSchema } from "@/domain/validation";
import { demoSummary } from "@/domain/demo";
import { investableValue } from "@/domain/portfolio-segments";
describe("shared scenario engine", () => {
  it("applies decimal percentage changes without scientific notation or invented prices", () => {
    const tiny = {
      ...demoSummary,
      positions: demoSummary.positions.map((p, i) => ({
        ...p,
        quote: i === 0 ? { ...p.quote!, price: "0.000000000123" } : null,
      })),
    };
    const prices = scenarioPercentagePrices(tiny, "10,5");
    expect(prices).toEqual({ bitcoin: "0.000000000135915" });
    expect(amountSchema.parse(prices.bitcoin)).toBe(prices.bitcoin);
    expect(scenarioPercentagePrices(tiny, "-100")).toEqual({ bitcoin: "0" });
    for (const invalid of ["", "abc", "-100.01", "Infinity"])
      expect(() => scenarioPercentagePrices(tiny, invalid)).toThrow();
    expect(calculateScenario(tiny, prices).positions[1].targetPrice).toBeNull();
  });
  it("uses only market-risk holdings and explicit current-price fallback", () => {
    const base = calculateScenario(demoSummary, {});
    expect(base.value).toBe(investableValue(demoSummary));
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
