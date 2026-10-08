import "server-only";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import type { Database } from "@/server/db";
import { watchlistItems } from "@/server/db/schema";
import type { Quote } from "@/domain/types";
import { targetTransition } from "@/domain/watchlist-target";
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
          isNotNull(watchlistItems.entryPrice),
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
      if (!next) continue;
      await tx
        .update(watchlistItems)
        .set({
          targetActive: next.active,
          targetQuoteAt: next.quoteAt,
          ...(next.notify
            ? {
                targetReachedAt: next.quoteAt,
                targetReachedPrice: next.price,
                targetReadAt: null,
              }
            : {}),
        })
        .where(eq(watchlistItems.id, item.id));
    }
  });
}
