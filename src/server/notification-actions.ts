"use server";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { requireUser } from "./auth";
import { getDb } from "./db";
import { assets, watchlistItems } from "./db/schema";
import { portfolioService } from "./services/portfolio";
import { evaluateWatchlistTargets } from "./services/watchlist-notifications";
import { getQuotes } from "./market";
import { idSchema } from "@/domain/validation";
import { userError } from "./errors";
export async function loadTargetNotifications(portfolioId: string) {
  const user = await requireUser();
  try {
    const db = getDb();
    await portfolioService(db, user.id).owned(portfolioId);
    const tracked = await db
      .select({ asset: assets })
      .from(watchlistItems)
      .innerJoin(assets, eq(assets.id, watchlistItems.assetId))
      .where(eq(watchlistItems.portfolioId, portfolioId));
    await evaluateWatchlistTargets(
      db,
      await getQuotes(tracked.map((row) => row.asset)),
      portfolioId,
    );
    const rows = await db
      .select({
        id: watchlistItems.id,
        symbol: assets.symbol,
        assetId: assets.id,
        target: watchlistItems.entryPrice,
        price: watchlistItems.targetReachedPrice,
        reachedAt: watchlistItems.targetReachedAt,
        readAt: watchlistItems.targetReadAt,
      })
      .from(watchlistItems)
      .innerJoin(assets, eq(assets.id, watchlistItems.assetId))
      .where(
        and(
          eq(watchlistItems.portfolioId, portfolioId),
          isNotNull(watchlistItems.targetReachedAt),
        ),
      )
      .orderBy(desc(watchlistItems.targetReachedAt));
    return {
      ok: true as const,
      rows: rows.map((r) => ({
        ...r,
        reachedAt: r.reachedAt!.toISOString(),
        readAt: r.readAt?.toISOString() ?? null,
      })),
    };
  } catch (error) {
    return { ok: false as const, error: userError(error) };
  }
}
export async function readTargetNotification(
  portfolioId: string,
  id: string,
  reachedAt: string,
) {
  const user = await requireUser();
  try {
    idSchema.parse(id);
    const date = new Date(reachedAt);
    if (!Number.isFinite(date.getTime())) throw new Error("INVALID_DATE");
    const db = getDb();
    await portfolioService(db, user.id).owned(portfolioId);
    await db
      .update(watchlistItems)
      .set({ targetReadAt: new Date() })
      .where(
        and(
          eq(watchlistItems.id, id),
          eq(watchlistItems.portfolioId, portfolioId),
          eq(watchlistItems.targetReachedAt, date),
        ),
      );
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: userError(error) };
  }
}
