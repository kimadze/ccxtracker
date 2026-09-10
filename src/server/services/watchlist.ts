import "server-only";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import type { Database } from "@/server/db";
import { watchlistItems, assets } from "@/server/db/schema";
import { idSchema, positiveAmount } from "@/domain/validation";
import { portfolioService } from "./portfolio";
const inputSchema = z.object({
  portfolioId: idSchema,
  assetId: z.string().min(1).max(120),
  entryPrice: positiveAmount.nullable(),
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
      return db
        .select({
          id: watchlistItems.id,
          asset: assets,
          entryPrice: watchlistItems.entryPrice,
          notes: watchlistItems.notes,
          createdAt: watchlistItems.createdAt,
        })
        .from(watchlistItems)
        .innerJoin(assets, eq(watchlistItems.assetId, assets.id))
        .where(eq(watchlistItems.portfolioId, portfolioId));
    },
    async save(input: unknown) {
      const data = inputSchema.parse(input);
      await portfolio.owned(data.portfolioId);
      if (data.assetId === "USD") throw new Error("UNKNOWN_ASSET");
      await db
        .insert(watchlistItems)
        .values(data)
        .onConflictDoUpdate({
          target: [watchlistItems.portfolioId, watchlistItems.assetId],
          set: {
            entryPrice: data.entryPrice,
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
