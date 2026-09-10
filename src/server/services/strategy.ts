import "server-only";
import { and, eq, asc } from "drizzle-orm";
import type { Database } from "@/server/db";
import { exitPlans, exitLevels, journals, assets } from "@/server/db/schema";
import { portfolioService } from "./portfolio";
import { exitPlanSchema, journalSchema } from "@/domain/strategy-validation";
import { calculateExit } from "@/domain/planning";
import { replayLedger } from "@/domain/ledger";
export function strategyService(db: Database, userId: string) {
  const portfolios = portfolioService(db, userId);
  return {
    async load(portfolioId: string, assetId: string) {
      await portfolios.owned(portfolioId);
      const [plan] = await db.select().from(exitPlans).where(and(eq(exitPlans.portfolioId, portfolioId), eq(exitPlans.assetId, assetId)));
      const levels = plan ? await db.select().from(exitLevels).where(eq(exitLevels.planId, plan.id)).orderBy(asc(exitLevels.level)) : [];
      const [journal] = await db.select().from(journals).where(and(eq(journals.portfolioId, portfolioId), eq(journals.assetId, assetId)));
      return { plan: plan ? { feePercent: plan.feePercent, levels: levels.map(l => ({ price: l.price, percentage: l.percentage })) } : null, journal: journal ?? null };
    },
    async saveExit(input: unknown) {
      const data = exitPlanSchema.parse(input); await portfolios.owned(data.portfolioId);
      const holding = replayLedger(await portfolios.entries(data.portfolioId)).holdings.find(h => h.assetId === data.assetId);
      if (!holding || holding.costBasis === null) throw new Error("UNKNOWN_BASIS");
      calculateExit({ quantity: holding.quantity, costBasis: holding.costBasis, feePercent: data.feePercent, levels: data.levels });
      await db.transaction(async tx => {
        const [plan] = await tx.insert(exitPlans).values({ portfolioId: data.portfolioId, assetId: data.assetId, feePercent: data.feePercent }).onConflictDoUpdate({ target: [exitPlans.portfolioId, exitPlans.assetId], set: { feePercent: data.feePercent, updatedAt: new Date() } }).returning();
        await tx.delete(exitLevels).where(eq(exitLevels.planId, plan.id));
        await tx.insert(exitLevels).values(data.levels.map((l, i) => ({ planId: plan.id, level: i + 1, ...l })));
      });
    },
    async saveJournal(input: unknown) {
      const data = journalSchema.parse(input); await portfolios.owned(data.portfolioId);
      const [asset] = await db.select().from(assets).where(eq(assets.id, data.assetId)); if (!asset) throw new Error("UNKNOWN_ASSET");
      const [journal] = await db.insert(journals).values(data).onConflictDoUpdate({ target: [journals.portfolioId, journals.assetId], set: { ...data, updatedAt: new Date() } }).returning();
      return journal.id;
    },
  };
}
