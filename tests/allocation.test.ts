import { describe, expect, it } from "vitest";
import { calculateDeployment, validateWeights } from "@/domain/allocation";
import { decimal } from "@/domain/decimal";
const rows = [
  { assetId: "btc", value: "800", weight: "50", price: "100" },
  { assetId: "eth", value: "200", weight: "40", price: "20" },
  { assetId: "USD", value: "0", weight: "10", price: "1" },
];
describe("allocation and capital conservation", () => {
  it("rejects non-100 targets, duplicates and negative weights", () => {
    expect(() => validateWeights([{ assetId: "btc", weight: "90" }])).toThrow();
    expect(() =>
      validateWeights([
        { assetId: "btc", weight: "50" },
        { assetId: "btc", weight: "50" },
      ]),
    ).toThrow();
  });
  it("allocates only positive deficits without selling overweight positions", () => {
    const r = calculateDeployment(rows, "100");
    expect(r.rows[0].capital).toBe("0");
    expect(
      r.rows.reduce((s, row) => s.plus(row.capital), decimal(0)).toFixed(),
    ).toBe("100");
    expect(r.projectedValue).toBe("1100");
  });
  it("conserves one cent with deterministic rounding", () => {
    const r = calculateDeployment(
      [
        { assetId: "a", value: "0", weight: "33", price: null },
        { assetId: "b", value: "0", weight: "33", price: null },
        { assetId: "c", value: "0", weight: "34", price: null },
      ],
      "0.01",
    );
    expect(r.rows.map((r) => r.capital)).toEqual(["0", "0", "0.01"]);
  });
  it("accepts a cash-only empty portfolio and zero new capital", () => {
    const r = calculateDeployment(
      [{ assetId: "USD", value: "0", weight: "100", price: "1" }],
      "100",
    );
    expect(r.rows[0].capital).toBe("100");
    expect(
      calculateDeployment(rows, "0").rows.every((r) => r.capital === "0"),
    ).toBe(true);
  });
  it("validates custom budgets and cents", () => {
    expect(() => calculateDeployment(rows, "100", { btc: "50" })).toThrow(
      "CUSTOM_BUDGET_MISMATCH",
    );
    expect(() => calculateDeployment(rows, "0.001")).toThrow();
    const r = calculateDeployment(rows, "100", {
      btc: "50",
      eth: "50",
      USD: "0",
    });
    expect(r.rows[0].capital).toBe("50");
  });
});
