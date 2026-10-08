import "server-only";
import { and, eq, inArray, isNotNull, or } from "drizzle-orm";
import type { Database } from "@/server/db";
import { watchlistItems } from "@/server/db/schema";
import type { Quote } from "@/domain/types";
import { targetTransition } from "@/domain/watchlist-target";
import { enqueueTelegramTarget } from "../telegram/delivery";
export async function evaluateWatchlistTargets(
  db: Database,
  quotes: Quote[],
  portfolioId?: string,
) {
  if (!quotes.length) return;
  await db.transaction(async (tx) => {
    const items = await tx
      .select()
      .from(watchlistItems)
      .where(
        and(
          inArray(
            watchlistItems.assetId,
            quotes.map((q) => q.assetId),
          ),
          or(
            isNotNull(watchlistItems.entryPrice),
            isNotNull(watchlistItems.exitPrice),
          ),
          portfolioId ? eq(watchlistItems.portfolioId, portfolioId) : undefined,
        ),
      )
      .for("update");
    for (const item of items) {
      const next = targetTransition(
        item.entryPrice,
        item.targetActive,
        item.targetQuoteAt,
        quotes.find((q) => q.assetId === item.assetId),
      );
      const sell = targetTransition(
        item.exitPrice,
        item.sellTargetActive,
        item.sellTargetQuoteAt,
        quotes.find((q) => q.assetId === item.assetId),
        Date.now(),
        "sell",
      );
      if (!next && !sell) continue;
      await tx
        .update(watchlistItems)
        .set({
          ...(next
            ? { targetActive: next.active, targetQuoteAt: next.quoteAt }
            : {}),
          ...(next?.notify
            ? {
                targetReachedAt: next.quoteAt,
                targetReachedPrice: next.price,
                targetReadAt: null,
              }
            : {}),
          ...(sell
            ? { sellTargetActive: sell.active, sellTargetQuoteAt: sell.quoteAt }
            : {}),
          ...(sell?.notify
            ? {
                sellTargetReachedAt: sell.quoteAt,
                sellTargetReachedPrice: sell.price,
                sellTargetReadAt: null,
              }
            : {}),
        })
        .where(eq(watchlistItems.id, item.id));
      if (next?.notify)
        await enqueueTelegramTarget(
          tx as unknown as Database,
          item,
          "buy",
          next.quoteAt,
          next.price!,
        );
      if (sell?.notify)
        await enqueueTelegramTarget(
          tx as unknown as Database,
          item,
          "sell",
          sell.quoteAt,
          sell.price!,
        );
    }
  });
}
