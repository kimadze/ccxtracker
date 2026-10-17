import "server-only";
import { and, asc, eq, gt, inArray, lt, lte, like } from "drizzle-orm";
import { idSchema } from "@/domain/validation";
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
const retryPrefix = "snapshot-retry:";
async function queueSnapshotRetry(db: Database, portfolioId: string) {
  const key = `${retryPrefix}${portfolioId}`,
    day = new Date().toISOString().slice(0, 10);
  const [existing] = await db
    .select()
    .from(jobState)
    .where(eq(jobState.key, key));
  if (existing) {
    try {
      if (JSON.parse(existing.cursor ?? "{}")?.day === day) return;
    } catch {
      /* Replace malformed private retry metadata. */
    }
  }
  const cursor = JSON.stringify({ day, attempts: 0 }),
    leaseUntil = new Date(Date.now() + 300000);
  await db
    .insert(jobState)
    .values({
      key,
      cursor,
      leaseUntil,
    })
    .onConflictDoUpdate({
      target: jobState.key,
      set: { cursor, leaseUntil, updatedAt: new Date() },
    });
}

/** Only retry today's valuation: never backfill a past day using today's prices. */
export async function retrySkippedSnapshots(
  dependencies: SnapshotDependencies & {
    limit?: number;
    timeBudgetMs?: number;
  } = {},
) {
  const db = dependencies.db ?? getDb(),
    started = Date.now();
  const result = { processed: 0, created: 0, expired: 0, failed: 0 };
  const due = await db
    .select()
    .from(jobState)
    .where(
      and(
        like(jobState.key, `${retryPrefix}%`),
        lte(jobState.leaseUntil, new Date()),
      ),
    )
    .orderBy(asc(jobState.leaseUntil))
    .limit(Math.min(10, dependencies.limit ?? 3));
  for (const row of due) {
    if (Date.now() - started >= (dependencies.timeBudgetMs ?? 10000)) break;
    const leaseUntil = new Date(Date.now() + 65000);
    const [owned] = await db
      .update(jobState)
      .set({ leaseUntil, updatedAt: new Date() })
      .where(
        and(eq(jobState.key, row.key), lte(jobState.leaseUntil, new Date())),
      )
      .returning();
    if (!owned) continue;
    result.processed++;
    const condition = and(
      eq(jobState.key, row.key),
      eq(jobState.leaseUntil, leaseUntil),
    );
    let metadata: { day?: string; attempts?: number };
    try {
      const parsed = JSON.parse(row.cursor ?? "{}");
      metadata =
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? parsed
          : {};
    } catch {
      metadata = {};
    }
    const id = idSchema.safeParse(row.key.slice(retryPrefix.length));
    if (!id.success || metadata.day !== new Date().toISOString().slice(0, 10)) {
      await db.delete(jobState).where(condition);
      result.expired++;
      continue;
    }
    try {
      const captured = await capturePortfolioSnapshot(id.data, dependencies);
      if (captured.reason === null) {
        result.created += Number(captured.created);
        await db.delete(jobState).where(condition);
        continue;
      }
    } catch (error) {
      if (error instanceof Error && error.message === "RESOURCE_NOT_FOUND") {
        await db.delete(jobState).where(condition);
        result.expired++;
        continue;
      }
      console.error("SNAPSHOT_RETRY_FAILED", {
        operation: "capture-current-day",
        reason: error instanceof Error ? error.name : "UNKNOWN",
      });
    }
    result.failed++;
    await db
      .update(jobState)
      .set({
        leaseUntil: new Date(Date.now() + 300000),
        cursor: JSON.stringify({
          day: metadata.day,
          attempts:
            (Number.isSafeInteger(metadata.attempts) ? metadata.attempts! : 0) +
            1,
        }),
        updatedAt: new Date(),
      })
      .where(condition);
  }
  return result;
}

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
    if (lockedAssetIds.some((id) => !initialAssetIds.includes(id))) {
      await queueSnapshotRetry(tx as unknown as Database, portfolioId);
      return { created: false, reason: "INCOMPLETE_VALUATION" as const };
    }
    const summary = valuePortfolio(
      replayLedger(entries),
      requiredAssets,
      quotes,
    );
    if (!summary.complete || summary.stale || summary.value === null) {
      await queueSnapshotRetry(tx as unknown as Database, portfolioId);
      return { created: false, reason: "INCOMPLETE_VALUATION" as const };
    }

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
    return {
      busy: true,
      processed: 0,
      skipped: 0,
      complete: false,
      cursor: null,
    };
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
      ...new Set([...entriesByPortfolio.values()].flatMap(activeAssetIds)),
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
          await queueSnapshotRetry(tx as unknown as Database, p.id);
          skipped++;
          return;
        }
        const summary = valuePortfolio(
          replayLedger(entries),
          batchAssets,
          quotes,
        );
        if (!summary.complete || summary.stale || summary.value === null) {
          await queueSnapshotRetry(tx as unknown as Database, p.id);
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
