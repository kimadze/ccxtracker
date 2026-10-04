import { decimal } from "./decimal";

export type RiskInputs = {
  direction: "LONG" | "SHORT";
  accountBalance: string;
  entryPrice: string;
  stopLoss: string;
  takeProfit: string;
  riskPercent: string;
  leverage: string;
};
export type RiskField = keyof RiskInputs;
export function calculateRisk(input: RiskInputs) {
  const errors: Partial<Record<RiskField, string>> = {};
  const keys = [
    "accountBalance",
    "entryPrice",
    "stopLoss",
    "takeProfit",
    "riskPercent",
    "leverage",
  ] as const;
  const values = {} as Record<
    (typeof keys)[number],
    ReturnType<typeof decimal>
  >;
  for (const key of keys) {
    try {
      values[key] = decimal(input[key]);
      if (!values[key].gt(0)) throw new Error();
    } catch {
      errors[key] = "შეიყვანეთ დადებითი რიცხვი.";
    }
  }
  if (input.direction !== "LONG" && input.direction !== "SHORT")
    errors.direction = "აირჩიეთ LONG ან SHORT.";
  if (values.riskPercent?.gt(100))
    errors.riskPercent = "რისკი არ უნდა აღემატებოდეს 100%-ს.";
  if (values.leverage?.lt(1))
    errors.leverage = "ლევერიჯი უნდა იყოს მინიმუმ 1x.";
  if (Object.keys(errors).length) return { ok: false as const, errors };
  const {
    accountBalance,
    entryPrice,
    stopLoss,
    takeProfit,
    riskPercent,
    leverage,
  } = values;
  const long = input.direction === "LONG";
  if (long ? stopLoss.gte(entryPrice) : stopLoss.lte(entryPrice))
    errors.stopLoss = long
      ? "Stop Loss უნდა იყოს Entry-ზე დაბლა."
      : "Stop Loss უნდა იყოს Entry-ზე მაღლა.";
  if (long ? takeProfit.lte(entryPrice) : takeProfit.gte(entryPrice))
    errors.takeProfit = long
      ? "Take Profit უნდა იყოს Entry-ზე მაღლა."
      : "Take Profit უნდა იყოს Entry-ზე დაბლა.";
  if (Object.keys(errors).length) return { ok: false as const, errors };
  const riskAmount = accountBalance.mul(riskPercent).div(100);
  const stopDistance = entryPrice.minus(stopLoss).abs();
  const profitDistance = long
    ? takeProfit.minus(entryPrice)
    : entryPrice.minus(takeProfit);
  const positionSize = riskAmount.mul(entryPrice).div(stopDistance);
  const result = {
    riskAmount,
    positionSize,
    quantity: positionSize.div(entryPrice),
    stopDistancePercent: stopDistance.div(entryPrice).mul(100),
    requiredMargin: positionSize.div(leverage),
    potentialLoss: riskAmount,
    potentialProfit: positionSize.mul(profitDistance).div(entryPrice),
    riskReward: profitDistance.div(stopDistance),
  };
  // Match the existing application's supported amount range before formatting.
  if (
    Object.values(result).some(
      (value) => !value.isFinite() || value.abs().gt("1e24"),
    )
  )
    return {
      ok: false as const,
      errors: {
        entryPrice: "შედეგი ზედმეტად დიდია. გადაამოწმეთ ფასები და რისკი.",
      },
    };
  return {
    ok: true as const,
    result: Object.fromEntries(
      Object.entries(result).map(([key, value]) => [key, value.toFixed()]),
    ) as Record<keyof typeof result, string>,
  };
}
