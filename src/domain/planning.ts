import { D, amount, decimal, percent } from "./decimal";

export function calculateDca(input: {
  quantity: string;
  costBasis: string;
  capital: string;
  price: string;
  fee: string;
  currentPrice: string | null;
  portfolioValue: string | null;
}) {
  const q = decimal(input.quantity),
    basis = decimal(input.costBasis),
    capital = decimal(input.capital),
    price = decimal(input.price),
    fee = decimal(input.fee);
  if (
    q.lt(0) ||
    basis.lt(0) ||
    capital.lte(0) ||
    price.lte(0) ||
    fee.lt(0) ||
    fee.gte(capital)
  )
    throw new Error("INVALID_PLAN");
  const added = capital.minus(fee).div(price),
    newQuantity = q.plus(added),
    newBasis = basis.plus(capital);
  // The entered capital is new external funding; value at today's market price includes fees/slippage.
  const currentValue =
    input.currentPrice === null ? null : q.mul(input.currentPrice);
  const addedValue =
    input.currentPrice === null ? null : added.mul(input.currentPrice);
  return {
    addedQuantity: amount(added),
    newQuantity: amount(newQuantity),
    newBasis: amount(newBasis),
    newAverage: amount(newBasis.div(newQuantity)),
    currentAverage: q.isZero() ? null : amount(basis.div(q)),
    projectedAllocation:
      input.portfolioValue === null ||
      currentValue === null ||
      addedValue === null
        ? null
        : percent(
            currentValue.plus(addedValue),
            decimal(input.portfolioValue).plus(addedValue),
          ),
  };
}
export interface ExitLevel {
  price: string;
  percentage: string;
}
export function calculateExit(input: {
  quantity: string;
  costBasis: string;
  feePercent: string;
  levels: ExitLevel[];
}) {
  const q = decimal(input.quantity),
    basis = decimal(input.costBasis),
    fee = decimal(input.feePercent);
  if (
    q.lte(0) ||
    basis.lt(0) ||
    fee.lt(0) ||
    fee.gte(100) ||
    !input.levels.length ||
    input.levels.length > 12
  )
    throw new Error("INVALID_PLAN");
  let totalPercent = new D(0),
    revenue = new D(0),
    sold = new D(0),
    profit = new D(0),
    recoveryLevel: number | null = null,
    recoveryQuantity: string | null = null;
  let previousPrice = new D(0);
  const levels = input.levels.map((level, i) => {
    const price = decimal(level.price),
      weight = decimal(level.percentage);
    if (
      price.lte(0) ||
      price.lte(previousPrice) ||
      weight.lte(0) ||
      weight.gt(100)
    )
      throw new Error("INVALID_PLAN");
    previousPrice = price;
    totalPercent = totalPercent.plus(weight);
    if (totalPercent.gt(100)) throw new Error("EXIT_EXCEEDS_HOLDINGS");
    const quantity = q.mul(weight).div(100),
      net = quantity.mul(price).mul(new D(1).minus(fee.div(100))),
      allocatedBasis = basis.mul(weight).div(100),
      levelProfit = net.minus(allocatedBasis);
    if (recoveryLevel === null && basis.gt(0) && revenue.plus(net).gte(basis)) {
      recoveryLevel = i + 1;
      recoveryQuantity = amount(
        basis.minus(revenue).div(price.mul(new D(1).minus(fee.div(100)))),
      );
    }
    revenue = revenue.plus(net);
    sold = sold.plus(quantity);
    profit = profit.plus(levelProfit);
    return {
      ...level,
      quantity: amount(quantity),
      revenue: amount(net),
      profit: amount(levelProfit),
    };
  });
  return {
    levels,
    revenue: amount(revenue),
    profit: amount(profit),
    remainingQuantity: amount(q.minus(sold)),
    remainingPercent: amount(new D(100).minus(totalPercent)),
    weightedExitPrice: sold.isZero() ? null : amount(revenue.div(sold)),
    recoveryLevel,
    recoveryQuantity,
    alreadyRecovered: basis.isZero(),
  };
}
