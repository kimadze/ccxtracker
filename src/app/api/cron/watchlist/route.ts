import { and, eq, isNotNull, isNull, or, asc, lte, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  assets,
  watchlistItems,
  portfolios,
  telegramConnections,
  jobState,
  exitPlans,
  exitLevels,
} from "@/server/db/schema";
import { getQuotes } from "@/server/market";
import { usableAlertQuote } from "@/domain/alert-quote";
import { sendJobAlert } from "@/server/job-alerts";
import { evaluateWatchlistTargets } from "@/server/services/watchlist-notifications";
import { processTelegramDeliveries } from "@/server/telegram/delivery";
import { secretMatches } from "@/server/telegram/api";
import {
  evaluateTakeProfits,
  processTakeProfitDeliveries,
} from "@/server/telegram/take-profit";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  const secrets = [
    process.env.PRICE_ALERT_CRON_SECRET,
    process.env.CRON_SECRET,
  ].filter((value): value is string => Boolean(value && value.length >= 32));
  if (!secrets.length) return new Response(null, { status: 503 });
  if (
    !secrets.some((secret) =>
      secretMatches(request.headers.get("authorization"), `Bearer ${secret}`),
    )
  )
    return new Response(null, { status: 401 });
  const db = getDb(),
    key = "watchlist-notifications";
  await db
    .insert(jobState)
    .values({ key, leaseUntil: new Date(0) })
    .onConflictDoNothing();
  const now = new Date();
  const [lease] = await db
    .update(jobState)
    .set({ leaseUntil: new Date(now.getTime() + 65000), updatedAt: now })
    .where(and(eq(jobState.key, key), lteLease(now)))
    .returning();
  if (!lease) return Response.json({ busy: true });
  try {
    const watchTracked = await db
      .selectDistinct({ asset: assets })
      .from(watchlistItems)
      .innerJoin(assets, eq(assets.id, watchlistItems.assetId))
      .innerJoin(portfolios, eq(portfolios.id, watchlistItems.portfolioId))
      .innerJoin(
        telegramConnections,
        eq(telegramConnections.userId, portfolios.userId),
      )
      .where(
        and(
          isNotNull(telegramConnections.chatId),
          sql`${telegramConnections.portfolioIds} @> jsonb_build_array(${watchlistItems.portfolioId}::text)`,
          or(
            and(
              isNotNull(watchlistItems.entryPrice),
              eq(telegramConnections.buyEnabled, true),
              isNull(watchlistItems.targetReachedAt),
            ),
            and(
              isNotNull(watchlistItems.exitPrice),
              eq(telegramConnections.sellEnabled, true),
              isNull(watchlistItems.sellTargetReachedAt),
            ),
          ),
        ),
      )
      .orderBy(asc(assets.id));
    const tpTracked = await db
      .selectDistinct({ asset: assets })
      .from(exitPlans)
      .innerJoin(exitLevels, eq(exitLevels.planId, exitPlans.id))
      .innerJoin(assets, eq(assets.id, exitPlans.assetId))
      .innerJoin(portfolios, eq(portfolios.id, exitPlans.portfolioId))
      .innerJoin(
        telegramConnections,
        eq(telegramConnections.userId, portfolios.userId),
      )
      .where(
        and(
          eq(exitPlans.telegramEnabled, true),
          isNull(exitLevels.reachedAt),
          isNotNull(telegramConnections.chatId),
        ),
      );
    const tracked = [
      ...new Map(
        [...watchTracked, ...tpTracked].map((r) => [r.asset.id, r]),
      ).values(),
    ].sort((a, b) => a.asset.id.localeCompare(b.asset.id));
    // Rotate across provider's bounded refresh batches instead of starving later assets.
    const cursor = typeof lease.cursor === "string" ? lease.cursor : "";
    const afterCursor = tracked.filter((r) => r.asset.id > cursor);
    const batch = (afterCursor.length ? afterCursor : tracked).slice(0, 100);
    const quotes = await getQuotes(
      batch.map((r) => r.asset),
      { mode: "blocking" },
    );
    const usable = quotes.filter((q) => usableAlertQuote(q));
    await evaluateWatchlistTargets(db, usable);
    await evaluateTakeProfits(db, usable);
    const tpDelivery = await processTakeProfitDeliveries(db, 3);
    const delivery = await processTelegramDeliveries(db, 3);
    const degraded = usable.length < batch.length;
    const health = {
      requested: batch.length,
      evaluated: usable.length,
      missing: batch.length - usable.length,
      degraded,
    };
    await db
      .insert(jobState)
      .values({
        key: "watchlist-health",
        cursor: JSON.stringify(health),
        leaseUntil: degraded ? new Date(0) : new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: jobState.key,
        set: {
          cursor: JSON.stringify(health),
          ...(!degraded ? { leaseUntil: new Date() } : {}),
          updatedAt: new Date(),
        },
      });
    if (degraded)
      await sendJobAlert("PRICE_ALERT_QUOTES_INCOMPLETE", health.missing);
    await db
      .update(jobState)
      .set({ cursor: batch.at(-1)?.asset.id ?? null })
      .where(eq(jobState.key, key));
    return Response.json(
      {
        checked: usable.length,
        ...health,
        ...delivery,
        takeProfit: tpDelivery,
      },
      { status: batch.length && !usable.length ? 503 : 200 },
    );
  } catch {
    console.error("WATCHLIST_CRON_FAILED");
    return Response.json({ error: "შემოწმება ვერ შესრულდა." }, { status: 500 });
  } finally {
    await db
      .update(jobState)
      .set({ leaseUntil: new Date(0), updatedAt: new Date() })
      .where(eq(jobState.key, key));
  }
}
function lteLease(now: Date) {
  return lte(jobState.leaseUntil, now);
}
export const POST = GET;
