import "server-only";
import { z } from "zod";
import { and, eq, sql, inArray } from "drizzle-orm";
import type { Database } from "@/server/db";
import {
  watchlistItems,
  assets,
  marketQuotes,
  telegramDeliveries,
} from "@/server/db/schema";
import { decimal } from "@/domain/decimal";
import { usableAlertQuote } from "@/domain/alert-quote";
import { idSchema, positiveAmount } from "@/domain/validation";
import { portfolioService } from "./portfolio";
const inputSchema = z.object({
  portfolioId: idSchema,
  assetId: z.string().min(1).max(120),
  entryPrice: positiveAmount.nullable(),
  exitPrice: positiveAmount.nullable().default(null),
  notes: z
    .string()
    .trim()
    .max(5000, "შენიშვნა არ უნდა აღემატებოდეს 5 000 სიმბოლოს."),
});
export function watchlistService(db: Database, userId: string) {
  const portfolio = portfolioService(db, userId);
  return {
    async list(portfolioId: string) {
      await portfolio.owned(portfolioId);
      const rows = await db
        .select({
          id: watchlistItems.id,
          asset: assets,
          entryPrice: watchlistItems.entryPrice,
          exitPrice: watchlistItems.exitPrice,
          targetReachedAt: watchlistItems.targetReachedAt,
          targetReachedPrice: watchlistItems.targetReachedPrice,
          sellTargetReachedAt: watchlistItems.sellTargetReachedAt,
          sellTargetReachedPrice: watchlistItems.sellTargetReachedPrice,
          notes: watchlistItems.notes,
          createdAt: watchlistItems.createdAt,
        })
        .from(watchlistItems)
        .innerJoin(assets, eq(watchlistItems.assetId, assets.id))
        .where(eq(watchlistItems.portfolioId, portfolioId));
      const deliveries = rows.length
        ? await db
            .select()
            .from(telegramDeliveries)
            .where(
              and(
                eq(telegramDeliveries.userId, userId),
                inArray(
                  telegramDeliveries.watchlistId,
                  rows.map((r) => r.id),
                ),
              ),
            )
        : [];
      const status = (
        id: string,
        side: "buy" | "sell",
        reached: Date | null,
      ) => {
        const job = deliveries.find(
          (j) =>
            j.watchlistId === id &&
            j.side === side &&
            j.reachedAt.getTime() === reached?.getTime(),
        );
        return !job
          ? null
          : job.sentAt
            ? ("sent" as const)
            : job.attempts >= 8
              ? ("failed" as const)
              : ("pending" as const);
      };
      return rows.map((row) => ({
        ...row,
        targetDelivery: status(row.id, "buy", row.targetReachedAt),
        sellTargetDelivery: status(row.id, "sell", row.sellTargetReachedAt),
      }));
    },
    async save(input: unknown) {
      const data = inputSchema.parse(input);
      await portfolio.owned(data.portfolioId);
      if (data.assetId === "USD") throw new Error("UNKNOWN_ASSET");
      const [cached] = await db
        .select()
        .from(marketQuotes)
        .where(eq(marketQuotes.assetId, data.assetId));
      const quote = cached
        ? {
            assetId: data.assetId,
            price: cached.price,
            change24h: cached.change24h,
            updatedAt: cached.quotedAt.toISOString(),
            stale: false,
          }
        : undefined;
      const baseline = usableAlertQuote(quote) ? cached!.quotedAt : null;
      const below = Boolean(
        baseline &&
        data.entryPrice &&
        decimal(cached!.price!).lte(data.entryPrice),
      );
      const above = Boolean(
        baseline &&
        data.exitPrice &&
        decimal(cached!.price!).gte(data.exitPrice),
      );
      await db
        .insert(watchlistItems)
        .values({
          ...data,
          targetQuoteAt: data.entryPrice ? baseline : null,
          targetActive: below,
          sellTargetQuoteAt: data.exitPrice ? baseline : null,
          sellTargetActive: above,
        })
        .onConflictDoUpdate({
          target: [watchlistItems.portfolioId, watchlistItems.assetId],
          set: {
            entryPrice: data.entryPrice,
            exitPrice: data.exitPrice,
            sellTargetActive: sql`CASE WHEN ${watchlistItems.exitPrice} IS DISTINCT FROM ${data.exitPrice}::numeric THEN ${above} ELSE ${watchlistItems.sellTargetActive} END`,
            sellTargetQuoteAt: sql`CASE WHEN ${watchlistItems.exitPrice} IS DISTINCT FROM ${data.exitPrice}::numeric THEN ${data.exitPrice ? (baseline?.toISOString() ?? null) : null}::timestamptz ELSE ${watchlistItems.sellTargetQuoteAt} END`,
            sellTargetReachedAt: sql`CASE WHEN ${watchlistItems.exitPrice} IS DISTINCT FROM ${data.exitPrice}::numeric THEN NULL ELSE ${watchlistItems.sellTargetReachedAt} END`,
            sellTargetReachedPrice: sql`CASE WHEN ${watchlistItems.exitPrice} IS DISTINCT FROM ${data.exitPrice}::numeric THEN NULL ELSE ${watchlistItems.sellTargetReachedPrice} END`,
            sellTargetReadAt: sql`CASE WHEN ${watchlistItems.exitPrice} IS DISTINCT FROM ${data.exitPrice}::numeric THEN NULL ELSE ${watchlistItems.sellTargetReadAt} END`,
            targetActive: sql`CASE WHEN ${watchlistItems.entryPrice} IS DISTINCT FROM ${data.entryPrice}::numeric THEN ${below} ELSE ${watchlistItems.targetActive} END`,
            targetQuoteAt: sql`CASE WHEN ${watchlistItems.entryPrice} IS DISTINCT FROM ${data.entryPrice}::numeric THEN ${data.entryPrice ? (baseline?.toISOString() ?? null) : null}::timestamptz ELSE ${watchlistItems.targetQuoteAt} END`,
            targetReachedAt: sql`CASE WHEN ${watchlistItems.entryPrice} IS DISTINCT FROM ${data.entryPrice}::numeric THEN NULL ELSE ${watchlistItems.targetReachedAt} END`,
            targetReachedPrice: sql`CASE WHEN ${watchlistItems.entryPrice} IS DISTINCT FROM ${data.entryPrice}::numeric THEN NULL ELSE ${watchlistItems.targetReachedPrice} END`,
            targetReadAt: sql`CASE WHEN ${watchlistItems.entryPrice} IS DISTINCT FROM ${data.entryPrice}::numeric THEN NULL ELSE ${watchlistItems.targetReadAt} END`,
            notes: data.notes,
            updatedAt: new Date(),
          },
        });
    },
    async remove(portfolioId: string, id: string) {
      idSchema.parse(id);
      await portfolio.owned(portfolioId);
      await db
        .delete(watchlistItems)
        .where(
          and(
            eq(watchlistItems.id, id),
            eq(watchlistItems.portfolioId, portfolioId),
          ),
        );
    },
  };
}
