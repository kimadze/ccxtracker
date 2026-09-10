import Decimal from "decimal.js";

export const D = Decimal.clone({ precision: 60, rounding: Decimal.ROUND_HALF_EVEN });
export type Amount = string;
export function decimal(value: Decimal.Value) {
  const result = new D(value);
  if (!result.isFinite() || result.abs().gt("1e24")) throw new Error("INVALID_AMOUNT");
  return result;
}
export function amount(value: Decimal.Value): Amount {
  return decimal(value).toDecimalPlaces(18).toFixed();
}
export function percent(numerator: Decimal.Value, denominator: Decimal.Value): Amount | null {
  const divisor = decimal(denominator);
  return divisor.isZero() ? null : amount(decimal(numerator).div(divisor).mul(100));
}
