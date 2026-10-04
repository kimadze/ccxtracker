import { describe, expect, it } from "vitest";
import { calculateRisk, type RiskInputs } from "@/domain/risk-calculator";
import { decimal } from "@/domain/decimal";

const example: RiskInputs = {
  direction: "LONG",
  accountBalance: "10000",
  entryPrice: "100000",
  stopLoss: "99000",
  takeProfit: "102500",
  riskPercent: "0.5",
  leverage: "5",
};
describe("risk calculator", () => {
  it("calculates risk and margin without Take Profit", () => {
    const c = calculateRisk({ ...example, takeProfit: "", riskPercent: "2" });
    if (!c.ok) throw new Error();
    expect(c.result.riskAmount).toBe("200");
    expect(c.result.requiredMargin).toBe("4000");
    expect(c.result.potentialProfit).toBeNull();
    expect(c.result.riskReward).toBeNull();
  });
  it("matches the supplied LONG example", () => {
    const calculation = calculateRisk(example);
    expect(calculation.ok).toBe(true);
    if (!calculation.ok) throw new Error();
    expect(calculation.result).toEqual({
      riskAmount: "50",
      positionSize: "5000",
      quantity: "0.05",
      stopDistancePercent: "1",
      requiredMargin: "1000",
      potentialLoss: "50",
      potentialProfit: "125",
      riskReward: "2.5",
    });
  });
  it("supports SHORT and leverage only changes margin", () => {
    const calculation = calculateRisk({
      ...example,
      direction: "SHORT",
      stopLoss: "101000",
      takeProfit: "97500",
      leverage: "10",
    });
    if (!calculation.ok) throw new Error();
    expect(calculation.result.requiredMargin).toBe("500");
    expect(calculation.result.potentialProfit).toBe("125");
    expect(calculation.result.potentialLoss).toBe("50");
    expect(calculation.result.riskReward).toBe("2.5");
  });
  it.each([
    { stopLoss: "100000" },
    { stopLoss: "101000" },
    { takeProfit: "99000" },
    { accountBalance: "0" },
    { entryPrice: "-1" },
    { entryPrice: "NaN" },
    { leverage: "0" },
    { leverage: "0.5" },
    { riskPercent: "101" },
    { riskPercent: "" },
    { accountBalance: "Infinity" },
    { direction: "SHORT" as const, stopLoss: "99000", takeProfit: "102500" },
  ])("rejects invalid prices and numbers: %j", (change) => {
    expect(calculateRisk({ ...example, ...change }).ok).toBe(false);
  });
  it("preserves precision for tiny prices and accepts decimal comma", () => {
    const calculation = calculateRisk({
      ...example,
      entryPrice: "0.0000001",
      stopLoss: "0.00000009",
      takeProfit: "0.00000012",
      riskPercent: "0,25",
    });
    if (!calculation.ok) throw new Error();
    expect(calculation.result.positionSize).toBe("250");
    expect(calculation.result.quantity).toBe("2500000000");
    expect(decimal(calculation.result.potentialProfit!).eq(50)).toBe(true);
  });
});
