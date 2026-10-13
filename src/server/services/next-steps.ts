import "server-only";
import { eq } from "drizzle-orm";
import type { Database } from "../db";
import { assets, exitPlans, exitLevels, watchlistItems } from "../db/schema";
import { portfolioService } from "./portfolio";
import { getQuotes } from "../market";
import { rankNextSteps, type NextStep } from "@/domain/next-steps";
import type { PortfolioSummary } from "@/domain/types";
import { decimal } from "@/domain/decimal";
export async function loadNextSteps(
  db: Database,
  userId: string,
  portfolioId: string,
  summary: PortfolioSummary,
) {
  await portfolioService(db, userId).owned(portfolioId);
  const [levels, watch] = await Promise.all([
    db
      .select({
        id: exitLevels.id,
        asset: assets,
        level: exitLevels.level,
        price: exitLevels.price,
        percentage: exitLevels.percentage,
        reachedAt: exitLevels.reachedAt,
      })
      .from(exitLevels)
      .innerJoin(exitPlans, eq(exitLevels.planId, exitPlans.id))
      .innerJoin(assets, eq(exitPlans.assetId, assets.id))
      .where(eq(exitPlans.portfolioId, portfolioId)),
    db
      .select({
        id: watchlistItems.id,
        asset: assets,
        entryPrice: watchlistItems.entryPrice,
        exitPrice: watchlistItems.exitPrice,
        reached: watchlistItems.targetReachedAt,
        sellReached: watchlistItems.sellTargetReachedAt,
      })
      .from(watchlistItems)
      .innerJoin(assets, eq(watchlistItems.assetId, assets.id))
      .where(eq(watchlistItems.portfolioId, portfolioId)),
  ]);
  const rows: NextStep[] = levels
    .filter((l) =>
      summary.positions.some(
        (p) => p.assetId === l.asset.id && decimal(p.quantity).gt(0),
      ),
    )
    .map((l) => ({
      id: l.id,
      asset: l.asset,
      kind: "tp",
      level: l.level,
      target: l.price,
      share: l.percentage,
      reached: Boolean(l.reachedAt),
      current: null,
      distance: null,
    }));
  for (const w of watch) {
    if (w.entryPrice)
      rows.push({
        id: w.id + "-fall",
        asset: w.asset,
        kind: "fall",
        target: w.entryPrice,
        share: null,
        reached: Boolean(w.reached),
        current: null,
        distance: null,
      });
    if (w.exitPrice)
      rows.push({
        id: w.id + "-rise",
        asset: w.asset,
        kind: "rise",
        target: w.exitPrice,
        share: null,
        reached: Boolean(w.sellReached),
        current: null,
        distance: null,
      });
  }
  const held = summary.positions.flatMap((p) => (p.quote ? [p.quote] : []));
  const missing = rows
    .map((r) => r.asset)
    .filter(
      (a, i, all) =>
        !held.some((q) => q.assetId === a.id) &&
        all.findIndex((x) => x.id === a.id) === i,
    );
  const quotes = [...held, ...(missing.length ? await getQuotes(missing) : [])];
  const ranked = rankNextSteps(rows, quotes, Date.now());
  const selected = ranked.filter(
    (r, i, all) =>
      all.findIndex((x) => x.asset.id === r.asset.id && x.kind === r.kind) ===
      i,
  );
  return { rows: selected.slice(0, 3), total: rows.length };
}
