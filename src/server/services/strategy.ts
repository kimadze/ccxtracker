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
  marketQuotes,
  portfolios as portfolioTable,
} from "@/server/db/schema";
import { portfolioService } from "./portfolio";
import { exitPlanSchema, journalSchema } from "@/domain/strategy-validation";
import { calculateExit } from "@/domain/planning";
import { replayLedger } from "@/domain/ledger";
import { usableAlertQuote } from "@/domain/alert-quote";
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
      await db.transaction(async (tx) => {
        // Use the same lock as ledger mutations before reading the position.
        const [locked] = await tx
          .select()
          .from(portfolioTable)
          .where(
            and(
              eq(portfolioTable.id, data.portfolioId),
              eq(portfolioTable.userId, userId),
            ),
          )
          .for("update");
        if (!locked) throw new Error("RESOURCE_NOT_FOUND");
        const holding = replayLedger(
          await portfolioService(tx as unknown as Database, userId).entries(
            data.portfolioId,
          ),
        ).holdings.find((h) => h.assetId === data.assetId);
        if (!holding || decimal(holding.quantity).lte(0))
          throw new Error("INSUFFICIENT_HOLDINGS");
        calculateExit({
          quantity: holding.quantity,
          costBasis: holding.costBasis ?? "0",
          feePercent: data.feePercent,
          levels: data.levels,
        });
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
          )
          .for("update");
        const oldLevels = existing
          ? await tx
              .select()
              .from(exitLevels)
              .where(eq(exitLevels.planId, existing.id))
              .orderBy(asc(exitLevels.level))
          : [];
        const unchanged =
          // Keep completed levels even if another level is edited.
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
          ...(existing &&
          (!decimal(existing.alertQuantity ?? "0").eq(holding.quantity) ||
            existing.telegramEnabled !== data.telegramEnabled)
            ? { alertGeneration: randomUUID() }
            : {}),
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
        const [cached] = await tx
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
        await tx.delete(exitLevels).where(eq(exitLevels.planId, plan.id));
        await tx.insert(exitLevels).values(
          data.levels.map((l, i) => {
            const previous = oldLevels.find((old) =>
              decimal(old.price).eq(l.price),
            );
            const sameQuantity =
              existing &&
              decimal(existing.alertQuantity ?? "0").eq(holding.quantity);
            return {
              id: previous?.id,
              planId: plan.id,
              level: i + 1,
              ...l,
              alertQuoteAt: baseline,
              alertArmed: Boolean(
                baseline && decimal(cached!.price!).lt(l.price),
              ),
              ...(previous
                ? {
                    reachedAt: previous.reachedAt,
                    reachedPrice: previous.reachedPrice,
                    ...(sameQuantity &&
                    existing.telegramEnabled === data.telegramEnabled
                      ? {
                          alertQuoteAt: previous.alertQuoteAt,
                          alertArmed: previous.alertArmed,
                        }
                      : {}),
                  }
                : {}),
            };
          }),
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
        const [cached] = await tx
          .select()
          .from(marketQuotes)
          .where(eq(marketQuotes.assetId, assetId));
        const [level] = await tx
          .select()
          .from(exitLevels)
          .where(
            and(eq(exitLevels.id, levelId), eq(exitLevels.planId, plan.id)),
          );
        const quote = cached
          ? {
              assetId,
              price: cached.price,
              change24h: cached.change24h,
              updatedAt: cached.quotedAt.toISOString(),
              stale: false,
            }
          : undefined;
        const baseline = usableAlertQuote(quote) ? cached!.quotedAt : null;
        const rows = await tx
          .update(exitLevels)
          .set({
            reachedAt: null,
            reachedPrice: null,
            alertArmed: Boolean(
              level && baseline && decimal(cached!.price!).lt(level.price),
            ),
            alertQuoteAt: baseline,
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
      const { expectedUpdatedAt, ...data } = journalSchema.parse(input);
      await portfolios.owned(data.portfolioId);
      const [asset] = await db
        .select()
        .from(assets)
        .where(eq(assets.id, data.assetId));
      if (!asset) throw new Error("UNKNOWN_ASSET");
      return db.transaction(async (tx) => {
        // Serialize even the first insert; two empty editors must not overwrite.
        await tx
          .select({ id: portfolioTable.id })
          .from(portfolioTable)
          .where(eq(portfolioTable.id, data.portfolioId))
          .for("update");
        const [current] = await tx
          .select()
          .from(journals)
          .where(
            and(
              eq(journals.portfolioId, data.portfolioId),
              eq(journals.assetId, data.assetId),
            ),
          );
        if ((current?.updatedAt.toISOString() ?? null) !== expectedUpdatedAt)
          throw new Error("EDIT_CONFLICT");
        const updatedAt = new Date(
          Math.max(Date.now(), (current?.updatedAt.getTime() ?? 0) + 1),
        );
        const [journal] = current
          ? await tx
              .update(journals)
              .set({ ...data, updatedAt })
              .where(eq(journals.id, current.id))
              .returning()
          : await tx
              .insert(journals)
              .values({ ...data, updatedAt })
              .returning();
        return { id: journal.id, updatedAt: journal.updatedAt.toISOString() };
      });
    },
  };
}
