import { D, amount, decimal, percent } from "./decimal";
import type {
  Asset,
  LedgerResult,
  PortfolioSummary,
  ValuedPosition,
} from "./types";

export interface AssetAttribution {
  assetId: string;
  symbol: string;
  name: string;
  category: string;
  currentValue: string | null;
  realizedPnl: string | null;
  unrealizedPnl: string | null;
  totalPnl: string | null;
  contributionPercent: string | null;
  allocation: string | null;
  returnPercent: string | null;
  rank: number | null;
  isFee: boolean;
}

export interface CategoryAttribution {
  category: string;
  currentValue: string | null;
  allocation: string | null;
  totalPnl: string | null;
  contributionPercent: string | null;
  assets: string[];
  largestPositive: AssetAttribution | null;
  largestNegative: AssetAttribution | null;
}

export interface PortfolioAttribution {
  assets: AssetAttribution[];
  categories: CategoryAttribution[];
  totalPnl: string | null;
  complete: boolean;
  reconciled: boolean;
  topPositive: AssetAttribution | null;
  topNegative: AssetAttribution | null;
  assetsInProfit: number;
  assetsInLoss: number;
}

function total(realized: string | null, unrealized: string | null) {
  return realized === null || unrealized === null
    ? null
    : amount(decimal(realized).plus(unrealized));
}

export function calculateContributionPercentage(
  contribution: string | null,
  portfolioPnl: string | null,
) {
  if (
    contribution === null ||
    portfolioPnl === null ||
    decimal(portfolioPnl).isZero()
  )
    return null;
  return percent(contribution, portfolioPnl);
}

function positionFor(
  positions: ValuedPosition[],
  assetId: string,
): ValuedPosition | undefined {
  return positions.find((position) => position.assetId === assetId);
}

export function calculatePortfolioAttribution(
  ledger: LedgerResult,
  summary: PortfolioSummary,
  assets: Asset[],
): PortfolioAttribution {
  const rows: AssetAttribution[] = ledger.holdings.map((holding) => {
    const asset = assets.find((candidate) => candidate.id === holding.assetId);
    if (!asset) throw new Error("UNKNOWN_ASSET");
    const position = positionFor(summary.positions, holding.assetId);
    const closed = decimal(holding.quantity).isZero();
    const unrealizedPnl = closed
      ? holding.costBasis === null
        ? null
        : "0"
      : (position?.unrealizedPnl ?? null);
    return {
      assetId: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      category: asset.category ?? "other",
      currentValue: closed ? "0" : (position?.value ?? null),
      realizedPnl: holding.realizedPnl,
      unrealizedPnl,
      totalPnl: total(holding.realizedPnl, unrealizedPnl),
      contributionPercent: null,
      allocation: closed ? "0" : (position?.allocation ?? null),
      returnPercent: closed ? null : (position?.returnPercent ?? null),
      rank: null,
      isFee: false,
    };
  });

  if (!decimal(ledger.cashFees).isZero())
    rows.push({
      assetId: "__cash_fees__",
      symbol: "USD",
      name: "საკომისიოები",
      category: "fees",
      currentValue: "0",
      realizedPnl: amount(decimal(ledger.cashFees).neg()),
      unrealizedPnl: "0",
      totalPnl: amount(decimal(ledger.cashFees).neg()),
      contributionPercent: null,
      allocation: "0",
      returnPercent: null,
      rank: null,
      isFee: true,
    });

  const complete = rows.every((row) => row.totalPnl !== null);
  const totalPnl = complete
    ? amount(rows.reduce((sum, row) => sum.plus(row.totalPnl!), new D(0)))
    : null;
  const ranked = rows
    .filter((row) => row.totalPnl !== null)
    .sort((a, b) => decimal(b.totalPnl!).cmp(a.totalPnl!));
  ranked.forEach((row, index) => {
    row.rank = index + 1;
  });
  for (const row of rows)
    row.contributionPercent = calculateContributionPercentage(
      row.totalPnl,
      totalPnl,
    );

  const categories = calculateCategoryAttribution(
    rows,
    totalPnl,
    summary.value,
  );
  const positive = ranked.filter((row) => decimal(row.totalPnl!).gt(0));
  const negative = ranked.filter((row) => decimal(row.totalPnl!).lt(0));
  return {
    assets: ranked,
    categories,
    totalPnl,
    complete,
    reconciled:
      totalPnl !== null &&
      summary.totalPnl !== null &&
      decimal(totalPnl).eq(summary.totalPnl),
    topPositive: positive[0] ?? null,
    topNegative: negative.at(-1) ?? null,
    assetsInProfit: rows.filter(
      (row) =>
        !row.isFee && row.totalPnl !== null && decimal(row.totalPnl).gt(0),
    ).length,
    assetsInLoss: rows.filter(
      (row) =>
        !row.isFee && row.totalPnl !== null && decimal(row.totalPnl).lt(0),
    ).length,
  };
}

export function calculateCategoryAttribution(
  assets: AssetAttribution[],
  portfolioPnl: string | null,
  portfolioValue: string | null,
): CategoryAttribution[] {
  const groups = new Map<string, AssetAttribution[]>();
  for (const asset of assets)
    groups.set(asset.category, [...(groups.get(asset.category) ?? []), asset]);
  return [...groups]
    .map(([category, rows]) => {
      const knownPnl = rows.every((row) => row.totalPnl !== null);
      const knownValue = rows.every((row) => row.currentValue !== null);
      const totalPnl = knownPnl
        ? amount(rows.reduce((sum, row) => sum.plus(row.totalPnl!), new D(0)))
        : null;
      const currentValue = knownValue
        ? amount(
            rows.reduce((sum, row) => sum.plus(row.currentValue!), new D(0)),
          )
        : null;
      const sorted = rows
        .filter((row) => row.totalPnl !== null)
        .sort((a, b) => decimal(b.totalPnl!).cmp(a.totalPnl!));
      return {
        category,
        currentValue,
        allocation:
          currentValue === null || portfolioValue === null
            ? null
            : percent(currentValue, portfolioValue),
        totalPnl,
        contributionPercent: calculateContributionPercentage(
          totalPnl,
          portfolioPnl,
        ),
        assets: rows.filter((row) => !row.isFee).map((row) => row.symbol),
        largestPositive:
          sorted.find((row) => decimal(row.totalPnl!).gt(0)) ?? null,
        largestNegative:
          [...sorted].reverse().find((row) => decimal(row.totalPnl!).lt(0)) ??
          null,
      };
    })
    .sort((a, b) =>
      decimal(b.totalPnl ?? "0")
        .abs()
        .cmp(decimal(a.totalPnl ?? "0").abs()),
    );
}
