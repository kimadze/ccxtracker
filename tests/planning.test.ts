import { describe, expect, it } from "vitest";
import { calculateDca, calculateExit } from "@/domain/planning";
describe("DCA", () => {
  it("includes fees, added quantity, average and projected allocation", () => { const r = calculateDca({ quantity: "10", costBasis: "1000", capital: "510", price: "50", fee: "10", currentPrice: "100", portfolioValue: "2000" }); expect(r.addedQuantity).toBe("10"); expect(r.newAverage).toBe("75.5"); expect(r.newBasis).toBe("1510"); expect(Number(r.projectedAllocation)).toBeCloseTo(66.66666667); });
  it("rejects zero prices and fees above budget", () => { expect(() => calculateDca({ quantity: "1", costBasis: "100", capital: "10", price: "0", fee: "0", currentPrice: null, portfolioValue: null })).toThrow(); });
});
describe("staged exits", () => {
  const input = { quantity: "10", costBasis: "1000", feePercent: "0", levels: [{ price: "100", percentage: "20" }, { price: "200", percentage: "50" }] };
  it("computes net proceeds, remaining holdings and recovery within a level", () => { const r = calculateExit(input); expect(r.revenue).toBe("1200"); expect(r.profit).toBe("500"); expect(r.remainingQuantity).toBe("3"); expect(r.recoveryLevel).toBe(2); expect(r.recoveryQuantity).toBe("4"); });
  it("includes percentage fees and reports unreachable recovery", () => { const r = calculateExit({ ...input, feePercent: "10", costBasis: "2000" }); expect(r.revenue).toBe("1080"); expect(r.recoveryLevel).toBeNull(); });
  it("rejects over-allocation, descending prices and empty holdings", () => { expect(() => calculateExit({ ...input, levels: [{ price: "100", percentage: "101" }] })).toThrow(); expect(() => calculateExit({ ...input, levels: [{ price: "200", percentage: "10" }, { price: "100", percentage: "10" }] })).toThrow(); expect(() => calculateExit({ ...input, quantity: "0" })).toThrow(); });
  it("can exit exactly 100% and handles zero basis explicitly", () => { const r = calculateExit({ ...input, costBasis: "0", levels: [{ price: "100", percentage: "100" }] }); expect(r.remainingQuantity).toBe("0"); expect(r.alreadyRecovered).toBe(true); });
});
