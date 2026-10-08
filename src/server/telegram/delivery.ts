import "server-only";
import { and, asc, eq, isNull, lte } from "drizzle-orm";
import { getDb, type Database } from "@/server/db";
import {
  telegramConnections,
  telegramDeliveries,
  watchlistItems,
  portfolios,
  assets,
} from "@/server/db/schema";
import {
  sendTelegram,
  TelegramError,
  telegramConfigured,
  appOrigin,
} from "./api";
import { unitPrice } from "@/lib/formatters";
export async function enqueueTelegramTarget(
  db: Database,
  item: typeof watchlistItems.$inferSelect,
  side: "buy" | "sell",
  quoteAt: Date,
  price: string,
) {
  const [owner] = await db
    .select({ userId: portfolios.userId })
    .from(portfolios)
    .where(eq(portfolios.id, item.portfolioId));
  if (!owner) return;
  const [connection] = await db
    .select()
    .from(telegramConnections)
    .where(eq(telegramConnections.userId, owner.userId));
  if (
    !connection?.chatId ||
    !connection.portfolioIds.includes(item.portfolioId) ||
    !(side === "buy" ? connection.buyEnabled : connection.sellEnabled)
  )
    return;
  const target = side === "buy" ? item.entryPrice : item.exitPrice;
  if (!target) return;
  await db
    .insert(telegramDeliveries)
    .values({
      userId: owner.userId,
      generation: connection.generation,
      watchlistId: item.id,
      side,
      reachedAt: quoteAt,
      target,
      price,
    })
    .onConflictDoNothing();
}
/** Durable, bounded claims. Telegram does not support an exactly-once delivery key. */
export async function processTelegramDeliveries(
  db: Database = getDb(),
  limit = 5,
) {
  if (!telegramConfigured()) return { sent: 0, failed: 0, configured: false };
  const jobs = await db.transaction(async (tx) => {
    const due = await tx
      .select()
      .from(telegramDeliveries)
      .where(
        and(
          isNull(telegramDeliveries.sentAt),
          lte(telegramDeliveries.nextAttemptAt, new Date()),
        ),
      )
      .orderBy(asc(telegramDeliveries.createdAt))
      .limit(Math.min(limit, 10))
      .for("update", { skipLocked: true });
    for (const job of due)
      await tx
        .update(telegramDeliveries)
        .set({ nextAttemptAt: new Date(Date.now() + 60000) })
        .where(eq(telegramDeliveries.id, job.id));
    return due;
  });
  let sent = 0,
    failed = 0;
  for (const job of jobs) {
    const [row] = await db
      .select({
        connection: telegramConnections,
        item: watchlistItems,
        asset: assets,
        portfolio: portfolios,
      })
      .from(telegramConnections)
      .innerJoin(watchlistItems, eq(watchlistItems.id, job.watchlistId))
      .innerJoin(assets, eq(assets.id, watchlistItems.assetId))
      .innerJoin(portfolios, eq(portfolios.id, watchlistItems.portfolioId))
      .where(eq(telegramConnections.userId, job.userId));
    const episode =
      row &&
      (job.side === "buy"
        ? row.item.targetReachedAt
        : row.item.sellTargetReachedAt);
    if (
      !row?.connection.chatId ||
      row.portfolio.userId !== job.userId ||
      row.connection.generation !== job.generation ||
      !row.connection.portfolioIds.includes(row.portfolio.id) ||
      !(job.side === "buy"
        ? row.connection.buyEnabled
        : row.connection.sellEnabled) ||
      episode?.getTime() !== job.reachedAt.getTime() ||
      Date.now() - job.createdAt.getTime() > 6 * 3600000
    ) {
      await db
        .delete(telegramDeliveries)
        .where(eq(telegramDeliveries.id, job.id));
      continue;
    }
    try {
      const direction = job.side === "buy" ? "შესყიდვის" : "გაყიდვის";
      const url = `${appOrigin()}/portfolios/${row.portfolio.id}/watchlist?asset=${encodeURIComponent(row.asset.id)}`;
      await sendTelegram(
        row.connection.chatId,
        `CCX · ${row.asset.symbol.slice(0, 40)}\n${direction} ფასი მიღწეულია\nსამიზნე ${job.side === "buy" ? "≤" : "≥"} ${unitPrice(job.target)}\nდაფიქსირებული ფასი: ${unitPrice(job.price)}\n${job.reachedAt.toISOString()}`,
        url,
      );
      await db
        .update(telegramDeliveries)
        .set({ sentAt: new Date(), lastError: null, updatedAt: new Date() })
        .where(eq(telegramDeliveries.id, job.id));
      sent++;
    } catch (error) {
      const code = error instanceof TelegramError ? error.code : 0,
        retryAfter = error instanceof TelegramError ? error.retryAfter : 0;
      const attempts = job.attempts + 1;
      if (code === 403)
        await db
          .update(telegramConnections)
          .set({
            buyEnabled: false,
            sellEnabled: false,
            lastError: "BOT_BLOCKED",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(telegramConnections.userId, job.userId),
              eq(telegramConnections.generation, job.generation),
            ),
          );
      if (code === 403 || code === 400 || attempts >= 8)
        await db
          .delete(telegramDeliveries)
          .where(eq(telegramDeliveries.id, job.id));
      else
        await db
          .update(telegramDeliveries)
          .set({
            attempts,
            nextAttemptAt: new Date(
              Date.now() +
                Math.max(
                  Math.min(retryAfter, 3600) * 1000,
                  Math.min(1800000, 30000 * 2 ** Math.min(attempts - 1, 6)),
                ),
            ),
            lastError: `TELEGRAM_${code}`,
            updatedAt: new Date(),
          })
          .where(eq(telegramDeliveries.id, job.id));
      failed++;
    }
  }
  // Retain sent records briefly for deduplication, not indefinitely.
  await db
    .delete(telegramDeliveries)
    .where(
      lte(telegramDeliveries.createdAt, new Date(Date.now() - 7 * 86400000)),
    );
  return { sent, failed, configured: true };
}
