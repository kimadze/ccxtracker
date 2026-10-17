import "server-only";
import { sql } from "drizzle-orm";
import { getDb, type Database } from "@/server/db";
import { telegramConfigured } from "./api";
import { enqueueDailyDigests, processDailyDigests } from "./digest";
import { processTelegramDeliveries } from "./delivery";
import { processTakeProfitDeliveries } from "./take-profit";

export async function telegramQueueHealth(db: Database) {
  const result = await db.execute<{
    pending: number;
    ready: number;
    oldest: Date | null;
  }>(sql`
    SELECT count(*)::int AS pending,
      count(*) FILTER (WHERE next_attempt_at <= now())::int AS ready,
      min(created_at) AS oldest
    FROM (
      SELECT created_at, next_attempt_at FROM telegram_deliveries WHERE sent_at IS NULL AND attempts < 8
      UNION ALL SELECT created_at, next_attempt_at FROM take_profit_deliveries WHERE sent_at IS NULL AND attempts < 8
      UNION ALL SELECT created_at, next_attempt_at FROM telegram_digests WHERE sent_at IS NULL AND attempts < 5
    ) pending_jobs`);
  const row = result.rows[0];
  return {
    pending: row.pending,
    ready: row.ready,
    oldestAgeSeconds: row.oldest
      ? Math.max(
          0,
          Math.floor((Date.now() - new Date(row.oldest).getTime()) / 1000),
        )
      : 0,
  };
}

/** Fair bounded rounds: a busy alert type cannot starve reports or other alerts. */
export async function drainTelegramQueues(
  db: Database = getDb(),
  options: { deadline?: number; maxRounds?: number } = {},
) {
  const deadline = options.deadline ?? Date.now() + 45000;
  const totals = {
    watchlist: { sent: 0, failed: 0 },
    takeProfit: { sent: 0, failed: 0 },
    digest: { sent: 0, failed: 0 },
  };
  let rounds = 0;
  if (telegramConfigured() && Date.now() + 8000 < deadline) {
    await enqueueDailyDigests(db);
    for (; rounds < Math.min(20, options.maxRounds ?? 10); rounds++) {
      if (
        Date.now() + 8000 >= deadline ||
        !(await telegramQueueHealth(db)).ready
      )
        break;
      const work = [
        ["watchlist", () => processTelegramDeliveries(db, 1)],
        ["takeProfit", () => processTakeProfitDeliveries(db, 1)],
        [
          "digest",
          () => processDailyDigests(db, new Date(), { enqueue: false }),
        ],
      ] as const;
      for (const [kind, run] of work) {
        if (Date.now() + 8000 >= deadline) break;
        const result = await run();
        totals[kind].sent += result.sent;
        totals[kind].failed += result.failed;
      }
    }
  }
  return {
    ...totals,
    rounds,
    ...(await telegramQueueHealth(db)),
    budgetExhausted: Date.now() + 8000 >= deadline,
  };
}
