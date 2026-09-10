import { D, amount, decimal, percent } from "./decimal";
export interface AllocationRow {
  assetId: string;
  value: string;
  weight: string;
  price: string | null;
}
export function validateWeights(rows: { assetId: string; weight: string }[]) {
  if (
    !rows.length ||
    rows.length > 200 ||
    new Set(rows.map((r) => r.assetId)).size !== rows.length
  )
    throw new Error("INVALID_ALLOCATION");
  const total = rows.reduce((sum, row) => {
    const w = decimal(row.weight);
    if (w.lt(0) || w.gt(100)) throw new Error("INVALID_ALLOCATION");
    return sum.plus(w);
  }, new D(0));
  if (!total.eq(100)) throw new Error("INVALID_ALLOCATION");
}
export function calculateDeployment(
  rows: AllocationRow[],
  capital: string,
  custom?: Record<string, string>,
) {
  validateWeights(rows);
  const budget = decimal(capital);
  if (budget.lt(0) || budget.decimalPlaces() > 2)
    throw new Error("INVALID_CAPITAL");
  const currentValue = rows.reduce((sum, row) => {
    const value = decimal(row.value);
    if (value.lt(0)) throw new Error("INVALID_PLAN");
    return sum.plus(value);
  }, new D(0));
  const total = currentValue.plus(budget);
  const deficits = rows.map((row) =>
    D.max(0, total.mul(row.weight).div(100).minus(row.value)),
  );
  const sumDeficits = deficits.reduce((s, v) => s.plus(v), new D(0));
  let allocation: InstanceType<typeof D>[];
  if (custom) {
    if (Object.keys(custom).some((id) => !rows.some((r) => r.assetId === id)))
      throw new Error("INVALID_ALLOCATION");
    allocation = rows.map((row) => {
      const value = decimal(custom[row.assetId] || "0");
      if (value.lt(0) || value.decimalPlaces() > 2)
        throw new Error("INVALID_CAPITAL");
      return value;
    });
    if (!allocation.reduce((s, v) => s.plus(v), new D(0)).eq(budget))
      throw new Error("CUSTOM_BUDGET_MISMATCH");
  } else if (budget.isZero()) allocation = rows.map(() => new D(0));
  else {
    if (sumDeficits.isZero()) throw new Error("INVALID_ALLOCATION");
    const exact = deficits.map((d) => budget.mul(d).div(sumDeficits));
    allocation = exact.map((v) => v.toDecimalPlaces(2, D.ROUND_DOWN));
    let cents = budget
      .minus(allocation.reduce((s, v) => s.plus(v), new D(0)))
      .mul(100)
      .toNumber();
    const order = exact
      .map((v, i) => ({ i, remainder: v.minus(allocation[i]) }))
      .sort(
        (a, b) =>
          b.remainder.cmp(a.remainder) ||
          rows[a.i].assetId.localeCompare(rows[b.i].assetId),
      );
    for (const { i } of order) {
      if (cents <= 0) break;
      allocation[i] = allocation[i].plus("0.01");
      cents--;
    }
  }
  return {
    currentValue: amount(currentValue),
    projectedValue: amount(total),
    rows: rows.map((row, i) => ({
      ...row,
      currentWeight: percent(row.value, currentValue),
      deviation: currentValue.isZero()
        ? null
        : amount(decimal(percent(row.value, currentValue)!).minus(row.weight)),
      capital: amount(allocation[i]),
      projectedValue: amount(decimal(row.value).plus(allocation[i])),
      projectedWeight: percent(decimal(row.value).plus(allocation[i]), total),
      addedQuantity:
        row.price === null || decimal(row.price).lte(0)
          ? null
          : amount(allocation[i].div(row.price)),
    })),
  };
}
