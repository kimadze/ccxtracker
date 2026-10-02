import "server-only";
import { and, asc, eq, gt, inArray, lt } from "drizzle-orm";
import { getDb, type Database } from "./db";
import {
  assets,
  jobState,
  portfolios,
  snapshots,
  transactions,
} from "./db/schema";
import { getQuotes } from "./market";
import { toLedger } from "./services/portfolio";
import { replayLedger } from "@/domain/ledger";
import { valuePortfolio } from "@/domain/valuation";

function activeAssetIds(entries: ReturnType<typeof toLedger>[]) {
  return replayLedger(entries)
    .holdings.filter((holding) => Number(holding.quantity) > 0)
    .map((holding) => holding.assetId);
}

type SnapshotDependencies = {
  db?: Database;
  loadQuotes?: typeof getQuotes;
};

/** Capture one portfolio without the scheduled-job lease. Used for a user's first chart point. */
export async function capturePortfolioSnapshot(
  portfolioId: string,
  dependencies: SnapshotDependencies = {},
) {
  const db = dependencies.db ?? getDb();
  const [portfolio] = await db
    .select()
    .from(portfolios)
    .where(eq(portfolios.id, portfolioId));
  if (!portfolio) throw new Error("RESOURCE_NOT_FOUND");

  const initialEntries = (
    await db
      .select()
      .from(transactions)
      .where(eq(transactions.portfolioId, portfolioId))
  ).map(toLedger);
  const initialAssetIds = activeAssetIds(initialEntries);
  const requiredAssets = initialAssetIds.length
    ? await db.select().from(assets).where(inArray(assets.id, initialAssetIds))
    : [];
  const quotes = requiredAssets.length
    ? await (dependencies.loadQuotes ?? getQuotes)(requiredAssets, {
        mode: "blocking",
      })
    : [];
  return db.transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(portfolios)
      .where(eq(portfolios.id, portfolioId))
      .for("update");
    if (!locked) throw new Error("RESOURCE_NOT_FOUND");
    const entries = (
      await tx
        .select()
        .from(transactions)
        .where(eq(transactions.portfolioId, portfolioId))
    ).map(toLedger);
    const lockedAssetIds = activeAssetIds(entries);
    if (lockedAssetIds.some((id) => !initialAssetIds.includes(id)))
      return { created: false, reason: "INCOMPLETE_VALUATION" as const };
    const summary = valuePortfolio(replayLedger(entries), requiredAssets, quotes);
    if (!summary.complete || summary.stale || summary.value === null)
      return { created: false, reason: "INCOMPLETE_VALUATION" as const };

    const capturedAt = new Date();
    const [created] = await tx
      .insert(snapshots)
      .values({
        portfolioId,
        day: capturedAt.toISOString().slice(0, 10),
        capturedAt,
        value: summary.value,
        cash: summary.cash,
        realizedPnl: summary.realizedPnl,
        unrealizedPnl: summary.unrealizedPnl,
        revision: locked.revision,
      })
      .onConflictDoNothing()
      .returning({ id: snapshots.id });
    return { created: Boolean(created), reason: null };
  });
}

export async function runSnapshots(
  dependencies: {
    db?: Database;
    loadQuotes?: typeof getQuotes;
    timeBudgetMs?: number;
  } = {},
) {
  const db = dependencies.db ?? getDb(),
    now = new Date(),
    startedAt = Date.now(),
    timeBudgetMs = dependencies.timeBudgetMs ?? 45000;
  await db
    .insert(jobState)
    .values({ key: "snapshots", leaseUntil: new Date(0) })
    .onConflictDoNothing();
  const [lock] = await db
    .update(jobState)
    .set({ leaseUntil: new Date(now.getTime() + 70000) })
    .where(and(eq(jobState.key, "snapshots"), lt(jobState.leaseUntil, now)))
    .returning();
  if (!lock)
    return { busy: true, processed: 0, skipped: 0, complete: false, cursor: null };
  let processed = 0,
    skipped = 0,
    cursor = lock.cursor,
    complete = false;
  try {
    const batch = await db
      .select()
      .from(portfolios)
      .where(cursor ? gt(portfolios.id, cursor) : undefined)
      .orderBy(asc(portfolios.id))
      .limit(100);
    const portfolioIds = batch.map((portfolio) => portfolio.id);
    const batchEntries = portfolioIds.length
      ? await db
          .select()
          .from(transactions)
          .where(inArray(transactions.portfolioId, portfolioIds))
      : [];
    const entriesByPortfolio = new Map<string, ReturnType<typeof toLedger>[]>();
    for (const row of batchEntries) {
      const current = entriesByPortfolio.get(row.portfolioId) ?? [];
      current.push(toLedger(row));
      entriesByPortfolio.set(row.portfolioId, current);
    }
    const wantedAssetIds = [
      ...new Set(
        [...entriesByPortfolio.values()].flatMap(activeAssetIds),
      ),
    ];
    const batchAssets = wantedAssetIds.length
      ? await db.select().from(assets).where(inArray(assets.id, wantedAssetIds))
      : [];
    const quotes = batchAssets.length
      ? await (dependencies.loadQuotes ?? getQuotes)(batchAssets, {
          mode: "blocking",
        })
      : [];
    for (const p of batch) {
      if (Date.now() - startedAt > timeBudgetMs) break;
      await db.transaction(async (tx) => {
        const [locked] = await tx
          .select()
          .from(portfolios)
          .where(eq(portfolios.id, p.id))
          .for("update");
        if (!locked) return;
        const entries = (
          await tx
            .select()
            .from(transactions)
            .where(eq(transactions.portfolioId, p.id))
        ).map(toLedger);
        const requiredIds = activeAssetIds(entries);
        if (requiredIds.some((id) => !wantedAssetIds.includes(id))) {
          skipped++;
          return;
        }
        const summary = valuePortfolio(
          replayLedger(entries),
          batchAssets,
          quotes,
        );
        if (!summary.complete || summary.stale || summary.value === null) {
          skipped++;
          return;
        }
        const capturedAt = new Date();
        await tx
          .insert(snapshots)
          .values({
            portfolioId: p.id,
            day: capturedAt.toISOString().slice(0, 10),
            capturedAt,
            value: summary.value,
            cash: summary.cash,
            realizedPnl: summary.realizedPnl,
            unrealizedPnl: summary.unrealizedPnl,
            revision: locked.revision,
          })
          .onConflictDoNothing();
      });
      cursor = p.id;
      processed++;
      await db
        .update(jobState)
        .set({ cursor, updatedAt: new Date() })
        .where(eq(jobState.key, "snapshots"));
    }
    complete = processed === batch.length && batch.length < 100;
    if (complete) cursor = null;
    return { busy: false, processed, skipped, complete, cursor };
  } finally {
    await db
      .update(jobState)
      .set({ cursor, leaseUntil: new Date(0), updatedAt: new Date() })
      .where(eq(jobState.key, "snapshots"));
  }
}
