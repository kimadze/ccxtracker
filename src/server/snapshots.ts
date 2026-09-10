import "server-only";
import { and, asc, eq, gt, lt } from "drizzle-orm";
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

export async function runSnapshots(dependencies?: {
  db: Database;
  loadQuotes: typeof getQuotes;
}) {
  const db = dependencies?.db ?? getDb(),
    now = new Date();
  await db
    .insert(jobState)
    .values({ key: "snapshots", leaseUntil: new Date(0) })
    .onConflictDoNothing();
  const [lock] = await db
    .update(jobState)
    .set({ leaseUntil: new Date(now.getTime() + 70000) })
    .where(and(eq(jobState.key, "snapshots"), lt(jobState.leaseUntil, now)))
    .returning();
  if (!lock) return { busy: true, processed: 0, complete: false };
  let processed = 0,
    skipped = 0,
    cursor = lock.cursor,
    complete = false;
  try {
    const allAssets = await db.select().from(assets);
    const quotes = await (dependencies?.loadQuotes ?? getQuotes)(allAssets);
    const batch = await db
      .select()
      .from(portfolios)
      .where(cursor ? gt(portfolios.id, cursor) : undefined)
      .orderBy(asc(portfolios.id))
      .limit(100);
    for (const p of batch) {
      if (Date.now() - now.getTime() > 45000) break;
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
        const summary = valuePortfolio(
          replayLedger(entries),
          allAssets,
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
    return { busy: false, processed, skipped, complete };
  } finally {
    await db
      .update(jobState)
      .set({ cursor, leaseUntil: new Date(0), updatedAt: new Date() })
      .where(eq(jobState.key, "snapshots"));
  }
}
