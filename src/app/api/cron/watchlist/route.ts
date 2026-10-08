import { and, eq, isNotNull, or, asc, lte } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  assets,
  watchlistItems,
  portfolios,
  telegramConnections,
  jobState,
} from "@/server/db/schema";
import { getQuotes } from "@/server/market";
import { evaluateWatchlistTargets } from "@/server/services/watchlist-notifications";
import { processTelegramDeliveries } from "@/server/telegram/delivery";
import { secretMatches } from "@/server/telegram/api";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || process.env.CRON_SECRET.length < 32)
    return new Response(null, { status: 503 });
  if (
    !secretMatches(
      request.headers.get("authorization"),
      `Bearer ${process.env.CRON_SECRET}`,
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
    const tracked = await db
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
          or(
            isNotNull(watchlistItems.entryPrice),
            isNotNull(watchlistItems.exitPrice),
          ),
        ),
      )
      .orderBy(asc(assets.id));
    // Rotate across provider's bounded refresh batches instead of starving later assets.
    const cursor = typeof lease.cursor === "string" ? lease.cursor : "";
    const afterCursor = tracked.filter((r) => r.asset.id > cursor);
    const batch = (afterCursor.length ? afterCursor : tracked).slice(0, 100);
    await evaluateWatchlistTargets(
      db,
      await getQuotes(
        batch.map((r) => r.asset),
        { mode: "blocking" },
      ),
    );
    const delivery = await processTelegramDeliveries(db);
    await db
      .update(jobState)
      .set({ cursor: batch.at(-1)?.asset.id ?? null })
      .where(eq(jobState.key, key));
    return Response.json({ checked: batch.length, ...delivery });
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
