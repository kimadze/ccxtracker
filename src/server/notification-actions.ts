"use server";
import { and, eq, isNotNull, or } from "drizzle-orm";
import { requireUser } from "./auth";
import { getDb } from "./db";
import { assets, watchlistItems } from "./db/schema";
import { portfolioService } from "./services/portfolio";
import { evaluateWatchlistTargets } from "./services/watchlist-notifications";
import { getQuotes } from "./market";
import { idSchema } from "@/domain/validation";
import { userError } from "./errors";
import { after } from "next/server";
import { processTelegramDeliveries } from "./telegram/delivery";
import { telegramConfigured } from "./telegram/api";
import {
  evaluateTakeProfits,
  processTakeProfitDeliveries,
} from "./telegram/take-profit";
import { exitPlans } from "./db/schema";
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
    const tpAssets = await db
      .select({ asset: assets })
      .from(exitPlans)
      .innerJoin(assets, eq(assets.id, exitPlans.assetId))
      .where(
        and(
          eq(exitPlans.portfolioId, portfolioId),
          eq(exitPlans.telegramEnabled, true),
        ),
      );
    const quotes = await getQuotes([
      ...new Map(
        [...tracked, ...tpAssets].map((r) => [r.asset.id, r.asset]),
      ).values(),
    ]);
    await evaluateWatchlistTargets(db, quotes, portfolioId);
    await evaluateTakeProfits(db, quotes);
    if (telegramConfigured())
      after(async () => {
        try {
          await processTelegramDeliveries(db);
          await processTakeProfitDeliveries(db);
        } catch {
          console.warn("TELEGRAM_QUEUE_RETRY_PENDING");
        }
      });
    const rows = await db
      .select({
        id: watchlistItems.id,
        symbol: assets.symbol,
        assetId: assets.id,
        target: watchlistItems.entryPrice,
        price: watchlistItems.targetReachedPrice,
        reachedAt: watchlistItems.targetReachedAt,
        readAt: watchlistItems.targetReadAt,
        sellTarget: watchlistItems.exitPrice,
        sellPrice: watchlistItems.sellTargetReachedPrice,
        sellReachedAt: watchlistItems.sellTargetReachedAt,
        sellReadAt: watchlistItems.sellTargetReadAt,
      })
      .from(watchlistItems)
      .innerJoin(assets, eq(assets.id, watchlistItems.assetId))
      .where(
        and(
          eq(watchlistItems.portfolioId, portfolioId),
          or(
            isNotNull(watchlistItems.targetReachedAt),
            isNotNull(watchlistItems.sellTargetReachedAt),
          ),
        ),
      );
    return {
      ok: true as const,
      rows: rows
        .flatMap((r) => {
          const base = { id: r.id, symbol: r.symbol, assetId: r.assetId };
          return [
            ...(r.reachedAt
              ? [
                  {
                    ...base,
                    side: "buy" as const,
                    target: r.target,
                    price: r.price,
                    reachedAt: r.reachedAt.toISOString(),
                    readAt: r.readAt?.toISOString() ?? null,
                  },
                ]
              : []),
            ...(r.sellReachedAt
              ? [
                  {
                    ...base,
                    side: "sell" as const,
                    target: r.sellTarget,
                    price: r.sellPrice,
                    reachedAt: r.sellReachedAt.toISOString(),
                    readAt: r.sellReadAt?.toISOString() ?? null,
                  },
                ]
              : []),
          ];
        })
        .sort((a, b) => Date.parse(b.reachedAt) - Date.parse(a.reachedAt)),
    };
  } catch (error) {
    return { ok: false as const, error: userError(error) };
  }
}
export async function readTargetNotification(
  portfolioId: string,
  id: string,
  reachedAt: string,
  side: "buy" | "sell" = "buy",
) {
  const user = await requireUser();
  try {
    idSchema.parse(id);
    if (side !== "buy" && side !== "sell") throw new Error("INVALID_INPUT");
    const date = new Date(reachedAt);
    if (!Number.isFinite(date.getTime())) throw new Error("INVALID_DATE");
    const db = getDb();
    await portfolioService(db, user.id).owned(portfolioId);
    await db
      .update(watchlistItems)
      .set(
        side === "buy"
          ? { targetReadAt: new Date() }
          : { sellTargetReadAt: new Date() },
      )
      .where(
        and(
          eq(watchlistItems.id, id),
          eq(watchlistItems.portfolioId, portfolioId),
          eq(
            side === "buy"
              ? watchlistItems.targetReachedAt
              : watchlistItems.sellTargetReachedAt,
            date,
          ),
        ),
      );
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: userError(error) };
  }
}
