import "server-only";
import { and, eq, asc, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { decimal } from "@/domain/decimal";
import type { Database } from "@/server/db";
import {
  exitPlans,
  exitLevels,
  journals,
  assets,
  telegramConnections,
} from "@/server/db/schema";
import { portfolioService } from "./portfolio";
import { exitPlanSchema, journalSchema } from "@/domain/strategy-validation";
import { calculateExit } from "@/domain/planning";
import { replayLedger } from "@/domain/ledger";
export function strategyService(db: Database, userId: string) {
  const portfolios = portfolioService(db, userId);
  return {
    async journalAssets(portfolioId: string) {
      await portfolios.owned(portfolioId);
      return db
        .select({
          id: assets.id,
          symbol: assets.symbol,
          name: assets.name,
          providerId: assets.providerId,
          logoUrl: assets.logoUrl,
          isStablecoin: assets.isStablecoin,
        })
        .from(journals)
        .innerJoin(assets, eq(journals.assetId, assets.id))
        .where(eq(journals.portfolioId, portfolioId));
    },
    async load(portfolioId: string, assetId: string) {
      await portfolios.owned(portfolioId);
      const [plan] = await db
        .select()
        .from(exitPlans)
        .where(
          and(
            eq(exitPlans.portfolioId, portfolioId),
            eq(exitPlans.assetId, assetId),
          ),
        );
      const levels = plan
        ? await db
            .select()
            .from(exitLevels)
            .where(eq(exitLevels.planId, plan.id))
            .orderBy(asc(exitLevels.level))
        : [];
      const [journal] = await db
        .select()
        .from(journals)
        .where(
          and(
            eq(journals.portfolioId, portfolioId),
            eq(journals.assetId, assetId),
          ),
        );
      return {
        plan: plan
          ? {
              feePercent: plan.feePercent,
              telegramEnabled: plan.telegramEnabled,
              alertQuantity: plan.alertQuantity,
              levels: levels.map((l) => ({
                price: l.price,
                percentage: l.percentage,
                id: l.id,
                reachedAt: l.reachedAt?.toISOString() ?? null,
                alertArmed: l.alertArmed,
              })),
            }
          : null,
        journal: journal ?? null,
      };
    },
    async saveExit(input: unknown) {
      const data = exitPlanSchema.parse(input);
      await portfolios.owned(data.portfolioId);
      if (data.telegramEnabled) {
        const [connection] = await db
          .select()
          .from(telegramConnections)
          .where(eq(telegramConnections.userId, userId));
        if (!connection?.chatId) throw new Error("TELEGRAM_NOT_CONNECTED");
      }
      const holding = replayLedger(
        await portfolios.entries(data.portfolioId),
      ).holdings.find((h) => h.assetId === data.assetId);
      if (!holding || decimal(holding.quantity).lte(0))
        throw new Error("INSUFFICIENT_HOLDINGS");
      calculateExit({
        quantity: holding.quantity,
        costBasis: holding.costBasis ?? "0",
        feePercent: data.feePercent,
        levels: data.levels,
      });
      await db.transaction(async (tx) => {
        // Serializes concurrent edits and preserves one-shot state on an unchanged save.
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${data.portfolioId + ":" + data.assetId}))`,
        );
        const [existing] = await tx
          .select()
          .from(exitPlans)
          .where(
            and(
              eq(exitPlans.portfolioId, data.portfolioId),
              eq(exitPlans.assetId, data.assetId),
            ),
          );
        const oldLevels = existing
          ? await tx
              .select()
              .from(exitLevels)
              .where(eq(exitLevels.planId, existing.id))
              .orderBy(asc(exitLevels.level))
          : [];
        const unchanged =
          existing &&
          decimal(existing.alertQuantity ?? "0").eq(holding.quantity) &&
          oldLevels.length === data.levels.length &&
          oldLevels.every(
            (l, i) =>
              decimal(l.price).eq(data.levels[i].price) &&
              decimal(l.percentage).eq(data.levels[i].percentage),
          );
        const reset =
          !unchanged || existing?.telegramEnabled !== data.telegramEnabled;
        const state = {
          feePercent: data.feePercent,
          telegramEnabled: data.telegramEnabled,
          alertQuantity: holding.quantity,
          ...(reset ? { alertGeneration: randomUUID() } : {}),
          updatedAt: new Date(),
        };
        const [plan] = await tx
          .insert(exitPlans)
          .values({
            portfolioId: data.portfolioId,
            assetId: data.assetId,
            feePercent: data.feePercent,
            telegramEnabled: data.telegramEnabled,
            alertQuantity: holding.quantity,
          })
          .onConflictDoUpdate({
            target: [exitPlans.portfolioId, exitPlans.assetId],
            set: state,
          })
          .returning();
        if (!reset) return;
        await tx.delete(exitLevels).where(eq(exitLevels.planId, plan.id));
        await tx.insert(exitLevels).values(
          data.levels.map((l, i) => ({
            planId: plan.id,
            level: i + 1,
            ...l,
          })),
        );
      });
    },
    async rearmExit(portfolioId: string, assetId: string, levelId: string) {
      await portfolios.owned(portfolioId);
      await db.transaction(async (tx) => {
        const [plan] = await tx
          .select()
          .from(exitPlans)
          .where(
            and(
              eq(exitPlans.portfolioId, portfolioId),
              eq(exitPlans.assetId, assetId),
            ),
          )
          .for("update");
        if (!plan) throw new Error("RESOURCE_NOT_FOUND");
        const rows = await tx
          .update(exitLevels)
          .set({
            reachedAt: null,
            reachedPrice: null,
            alertArmed: false,
            alertQuoteAt: null,
          })
          .where(
            and(eq(exitLevels.id, levelId), eq(exitLevels.planId, plan.id)),
          )
          .returning();
        if (!rows.length) throw new Error("RESOURCE_NOT_FOUND");
        await tx
          .update(exitPlans)
          .set({ updatedAt: new Date() })
          .where(eq(exitPlans.id, plan.id));
      });
    },
    async saveJournal(input: unknown) {
      const data = journalSchema.parse(input);
      await portfolios.owned(data.portfolioId);
      const [asset] = await db
        .select()
        .from(assets)
        .where(eq(assets.id, data.assetId));
      if (!asset) throw new Error("UNKNOWN_ASSET");
      const [journal] = await db
        .insert(journals)
        .values(data)
        .onConflictDoUpdate({
          target: [journals.portfolioId, journals.assetId],
          set: { ...data, updatedAt: new Date() },
        })
        .returning();
      return journal.id;
    },
  };
}
