import "server-only";
import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { amountSchema, idSchema } from "@/domain/validation";
import { validateWeights } from "@/domain/allocation";
import type { Database } from "@/server/db";
import { assets, targetAllocations, portfolios } from "@/server/db/schema";
import { portfolioService } from "./portfolio";
const schema = z.object({
  portfolioId: idSchema,
  rows: z
    .array(
      z.object({ assetId: z.string().min(1).max(120), weight: amountSchema }),
    )
    .min(1)
    .max(200),
});
export function allocationService(db: Database, userId: string) {
  const portfolio = portfolioService(db, userId);
  return {
    async list(portfolioId: string) {
      await portfolio.owned(portfolioId);
      return db
        .select({
          assetId: targetAllocations.assetId,
          weight: targetAllocations.weight,
        })
        .from(targetAllocations)
        .where(eq(targetAllocations.portfolioId, portfolioId));
    },
    async save(input: unknown) {
      const data = schema.parse(input);
      await portfolio.owned(data.portfolioId);
      validateWeights(data.rows);
      const known = await db
        .select()
        .from(assets)
        .where(
          inArray(
            assets.id,
            data.rows.map((r) => r.assetId),
          ),
        );
      if (known.length !== data.rows.length) throw new Error("UNKNOWN_ASSET");
      await db.transaction(async (tx) => {
        await tx
          .select()
          .from(portfolios)
          .where(eq(portfolios.id, data.portfolioId))
          .for("update");
        await tx
          .delete(targetAllocations)
          .where(eq(targetAllocations.portfolioId, data.portfolioId));
        await tx
          .insert(targetAllocations)
          .values(
            data.rows.map((row) => ({ ...row, portfolioId: data.portfolioId })),
          );
      });
    },
  };
}
