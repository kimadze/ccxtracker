import "server-only";
import { and, asc, eq, inArray, isNull, lte } from "drizzle-orm";
import type { Database } from "@/server/db";
import { getDb } from "@/server/db";
import {
  exitPlans,
  exitLevels,
  portfolios,
  assets,
  takeProfitDeliveries,
  telegramConnections,
} from "@/server/db/schema";
import { portfolioService } from "@/server/services/portfolio";
import { replayLedger } from "@/domain/ledger";
import { amount, decimal } from "@/domain/decimal";
import type { Quote } from "@/domain/types";
import {
  appOrigin,
  sendTelegram,
  TelegramError,
  telegramConfigured,
} from "./api";
import { quantity, unitPrice, money } from "@/lib/formatters";

export async function evaluateTakeProfits(db: Database, quotes: Quote[]) {
  const valid = quotes.filter((q) => {
    const time = Date.parse(q.updatedAt);
    try {
      return (
        !q.stale &&
        Number.isFinite(time) &&
        time <= Date.now() + 60000 &&
        Date.now() - time < 15 * 60000 &&
        decimal(q.price).gt(0)
      );
    } catch {
      return false;
    }
  });
  if (!valid.length) return;
  const plans = await db
    .select({ plan: exitPlans, userId: portfolios.userId })
    .from(exitPlans)
    .innerJoin(portfolios, eq(portfolios.id, exitPlans.portfolioId))
    .where(
      and(
        eq(exitPlans.telegramEnabled, true),
        inArray(
          exitPlans.assetId,
          valid.map((q) => q.assetId),
        ),
      ),
    );
  for (const item of plans)
    await db.transaction(async (tx) => {
      const [plan] = await tx
        .select()
        .from(exitPlans)
        .where(eq(exitPlans.id, item.plan.id))
        .for("update");
      if (!plan?.telegramEnabled) return;
      const connection = (
        await tx
          .select()
          .from(telegramConnections)
          .where(eq(telegramConnections.userId, item.userId))
      )[0];
      if (!connection?.chatId) return;
      const holding = replayLedger(
        await portfolioService(tx as unknown as Database, item.userId).entries(
          plan.portfolioId,
        ),
      ).holdings.find((h) => h.assetId === plan.assetId);
      // The original saved position size is fixed: a sale/deposit requires reviewing the plan.
      if (
        !holding ||
        !plan.alertQuantity ||
        !decimal(holding.quantity).eq(plan.alertQuantity)
      )
        return;
      const quote = valid.find((q) => q.assetId === plan.assetId)!;
      const date = new Date(quote.updatedAt);
      const levels = await tx
        .select()
        .from(exitLevels)
        .where(eq(exitLevels.planId, plan.id))
        .orderBy(asc(exitLevels.level));
      const reached: (typeof takeProfitDeliveries.$inferInsert)["levels"] = [];
      for (const level of levels) {
        if (
          level.reachedAt ||
          (level.alertQuoteAt && date <= level.alertQuoteAt)
        )
          continue;
        const above = decimal(quote.price).gte(level.price);
        const notify = Boolean(level.alertQuoteAt && level.alertArmed && above);
        await tx
          .update(exitLevels)
          .set({
            alertQuoteAt: date,
            alertArmed: !above || level.alertArmed,
            ...(notify ? { reachedAt: date, reachedPrice: quote.price } : {}),
          })
          .where(eq(exitLevels.id, level.id));
        if (notify)
          reached.push({
            level: level.level,
            price: level.price,
            percentage: level.percentage,
            quantity: amount(
              decimal(plan.alertQuantity).mul(level.percentage).div(100),
            ),
          });
      }
      if (reached.length)
        await tx
          .insert(takeProfitDeliveries)
          .values({
            planId: plan.id,
            generation: plan.alertGeneration,
            connectionGeneration: connection.generation,
            reachedAt: date,
            price: quote.price,
            levels: reached,
          })
          .onConflictDoNothing();
    });
}

export async function processTakeProfitDeliveries(
  db: Database = getDb(),
  limit = 5,
) {
  if (!telegramConfigured()) return { sent: 0, failed: 0 };
  const jobs = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(takeProfitDeliveries)
      .where(
        and(
          isNull(takeProfitDeliveries.sentAt),
          lte(takeProfitDeliveries.nextAttemptAt, new Date()),
        ),
      )
      .orderBy(asc(takeProfitDeliveries.createdAt))
      .limit(Math.min(limit, 5))
      .for("update", { skipLocked: true });
    for (const row of rows)
      await tx
        .update(takeProfitDeliveries)
        .set({ nextAttemptAt: new Date(Date.now() + 60000) })
        .where(eq(takeProfitDeliveries.id, row.id));
    return rows;
  });
  let sent = 0,
    failed = 0;
  for (const job of jobs) {
    const [row] = await db
      .select({
        plan: exitPlans,
        asset: assets,
        connection: telegramConnections,
      })
      .from(exitPlans)
      .innerJoin(assets, eq(assets.id, exitPlans.assetId))
      .innerJoin(portfolios, eq(portfolios.id, exitPlans.portfolioId))
      .innerJoin(
        telegramConnections,
        eq(telegramConnections.userId, portfolios.userId),
      )
      .where(eq(exitPlans.id, job.planId));
    const holding = row
      ? replayLedger(
          await portfolioService(db, row.connection.userId).entries(
            row.plan.portfolioId,
          ),
        ).holdings.find((h) => h.assetId === row.asset.id)
      : null;
    if (
      !row?.connection.chatId ||
      !row.plan.telegramEnabled ||
      row.plan.alertGeneration !== job.generation ||
      row.connection.generation !== job.connectionGeneration ||
      !holding ||
      !decimal(holding.quantity).eq(row.plan.alertQuantity ?? "0") ||
      Date.now() - job.createdAt.getTime() > 6 * 3600000
    ) {
      await db
        .delete(takeProfitDeliveries)
        .where(eq(takeProfitDeliveries.id, job.id));
      continue;
    }
    try {
      const currentLevels = await db
        .select()
        .from(exitLevels)
        .where(eq(exitLevels.planId, job.planId));
      const activeLevels = job.levels.filter((l) =>
        currentLevels.some(
          (current) =>
            current.level === l.level &&
            current.reachedAt?.getTime() === job.reachedAt.getTime(),
        ),
      );
      if (!activeLevels.length) {
        await db
          .delete(takeProfitDeliveries)
          .where(eq(takeProfitDeliveries.id, job.id));
        continue;
      }
      const details = activeLevels
        .map(
          (l) =>
            `TP${l.level} · სამიზნე ${unitPrice(l.price)}\nგეგმა: ${l.percentage}% — ${quantity(l.quantity)} ${row.asset.symbol}\nსავარაუდო გაყიდვის თანხა: ${money(amount(decimal(l.quantity).mul(job.price)))}`,
        )
        .join("\n\n");
      await sendTelegram(
        row.connection.chatId,
        `${row.asset.symbol.slice(0, 40)} · Take Profit მიღწეულია\nმიმდინარე ფასი: ${unitPrice(job.price)}\n\n${details}\n\n${job.reachedAt.toISOString()}\nგაყიდვა ავტომატურად არ შესრულებულა.`,
        `${appOrigin()}/portfolios/${row.plan.portfolioId}/positions/${encodeURIComponent(row.asset.id)}?tab=exit`,
        "პოზიციის გახსნა",
      );
      await db
        .update(takeProfitDeliveries)
        .set({ sentAt: new Date() })
        .where(eq(takeProfitDeliveries.id, job.id));
      sent++;
    } catch (error) {
      const attempts = job.attempts + 1,
        code = error instanceof TelegramError ? error.code : 0;
      if (code === 400 || code === 403 || attempts >= 8)
        await db
          .delete(takeProfitDeliveries)
          .where(eq(takeProfitDeliveries.id, job.id));
      else
        await db
          .update(takeProfitDeliveries)
          .set({
            attempts,
            nextAttemptAt: new Date(
              Date.now() +
                Math.max(
                  Math.min(
                    error instanceof TelegramError ? error.retryAfter : 0,
                    3600,
                  ) * 1000,
                  Math.min(1800000, 30000 * 2 ** Math.min(attempts - 1, 6)),
                ),
            ),
          })
          .where(eq(takeProfitDeliveries.id, job.id));
      failed++;
    }
  }
  await db
    .delete(takeProfitDeliveries)
    .where(
      lte(takeProfitDeliveries.createdAt, new Date(Date.now() - 7 * 86400000)),
    );
  return { sent, failed };
}
