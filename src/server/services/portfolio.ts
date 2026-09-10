import "server-only";
import { and, asc, eq, sql, gte } from "drizzle-orm";
import type { Database } from "@/server/db";
import {
  assets,
  audits,
  portfolios,
  positions,
  transactions,
  snapshots,
} from "@/server/db/schema";
import {
  idSchema,
  portfolioSchema,
  transactionSchema,
} from "@/domain/validation";
import { replayLedger } from "@/domain/ledger";
import type { LedgerEntry } from "@/domain/types";

export class AccessError extends Error {
  constructor() {
    super("RESOURCE_NOT_FOUND");
  }
}
export function toLedger(row: typeof transactions.$inferSelect): LedgerEntry {
  return { ...row, occurredAt: row.occurredAt.toISOString() };
}

/** Identity comes only from the authenticated server boundary, never from request input. */
export function portfolioService(db: Database, userId: string) {
  if (!userId) throw new AccessError();
  async function owned(id: string) {
    idSchema.parse(id);
    const [portfolio] = await db
      .select()
      .from(portfolios)
      .where(and(eq(portfolios.id, id), eq(portfolios.userId, userId)));
    if (!portfolio) throw new AccessError();
    return portfolio;
  }
  return {
    owned,
    list: () =>
      db
        .select()
        .from(portfolios)
        .where(eq(portfolios.userId, userId))
        .orderBy(asc(portfolios.createdAt)),
    async create(input: unknown) {
      const data = portfolioSchema.parse(input);
      const [portfolio] = await db
        .insert(portfolios)
        .values({ userId, ...data })
        .returning();
      return portfolio;
    },
    async rename(id: string, input: unknown) {
      const data = portfolioSchema.parse(input);
      await owned(id);
      await db
        .update(portfolios)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(portfolios.id, id), eq(portfolios.userId, userId)));
    },
    async remove(id: string) {
      await owned(id);
      await db
        .delete(portfolios)
        .where(and(eq(portfolios.id, id), eq(portfolios.userId, userId)));
    },
    async entries(id: string) {
      await owned(id);
      return (
        await db
          .select()
          .from(transactions)
          .where(eq(transactions.portfolioId, id))
          .orderBy(asc(transactions.occurredAt), asc(transactions.sequence))
      ).map(toLedger);
    },
    async mutateTransaction(
      input: unknown,
      operation: "create" | "update",
      expectedRevision: number,
    ) {
      const data = transactionSchema.parse(input);
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
        throw new Error("INVALID_REVISION");
      await owned(data.portfolioId);
      return db.transaction(async (tx) => {
        const [portfolio] = await tx
          .select()
          .from(portfolios)
          .where(
            and(
              eq(portfolios.id, data.portfolioId),
              eq(portfolios.userId, userId),
            ),
          )
          .for("update");
        if (!portfolio) throw new AccessError();
        const existing = await tx
          .select()
          .from(transactions)
          .where(eq(transactions.portfolioId, data.portfolioId));
        const old = existing.find((t) => t.id === data.id);
        if (operation === "create" && old)
          return { revision: portfolio.revision };
        if (portfolio.revision !== expectedRevision)
          throw new Error("STALE_REVISION");
        if (operation === "update" && !old) throw new AccessError();
        const [asset] = await tx
          .select()
          .from(assets)
          .where(eq(assets.id, data.assetId));
        if (!asset) throw new Error("UNKNOWN_ASSET");
        const sequence = old?.sequence ?? portfolio.revision + 1;
        const entry: LedgerEntry = { ...data, sequence };
        const projection = replayLedger([
          ...existing.filter((t) => t.id !== data.id).map(toLedger),
          entry,
        ]);
        const values = {
          ...data,
          occurredAt: new Date(data.occurredAt),
          sequence,
          updatedAt: new Date(),
        };
        if (old) {
          await tx.insert(audits).values({
            portfolioId: data.portfolioId,
            userId,
            operation: "transaction.update",
            before: old,
          });
          await tx
            .update(transactions)
            .set(values)
            .where(
              and(
                eq(transactions.id, data.id),
                eq(transactions.portfolioId, data.portfolioId),
              ),
            );
        } else await tx.insert(transactions).values(values);
        await tx
          .delete(positions)
          .where(eq(positions.portfolioId, data.portfolioId));
        if (projection.holdings.length)
          await tx.insert(positions).values(
            projection.holdings.map((h) => ({
              portfolioId: data.portfolioId,
              assetId: h.assetId,
              quantity: h.quantity,
              costBasis: h.costBasis,
              realizedPnl: h.realizedPnl,
            })),
          );
        await tx
          .update(portfolios)
          .set({
            revision: sql`${portfolios.revision} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(portfolios.id, data.portfolioId));
        const invalidFrom = new Date(
          Math.min(
            Date.parse(data.occurredAt),
            old?.occurredAt.getTime() ?? Infinity,
          ),
        );
        await tx
          .delete(snapshots)
          .where(
            and(
              eq(snapshots.portfolioId, data.portfolioId),
              gte(snapshots.capturedAt, invalidFrom),
            ),
          );
        return { revision: portfolio.revision + 1 };
      });
    },
    async deletePosition(
      portfolioId: string,
      assetId: string,
      expectedRevision: number,
    ) {
      if (
        typeof assetId !== "string" ||
        !assetId ||
        assetId === "USD" ||
        assetId.length > 120
      )
        throw new Error("UNKNOWN_ASSET");
      await owned(portfolioId);
      await db.transaction(async (tx) => {
        const [portfolio] = await tx
          .select()
          .from(portfolios)
          .where(
            and(eq(portfolios.id, portfolioId), eq(portfolios.userId, userId)),
          )
          .for("update");
        if (!portfolio) throw new AccessError();
        if (portfolio.revision !== expectedRevision)
          throw new Error("STALE_REVISION");
        const rows = await tx
          .select()
          .from(transactions)
          .where(eq(transactions.portfolioId, portfolioId));
        const removed = rows.filter((t) => t.assetId === assetId);
        if (!removed.length) throw new AccessError();
        const projection = replayLedger(
          rows.filter((t) => t.assetId !== assetId).map(toLedger),
        );
        await tx.insert(audits).values({
          portfolioId,
          userId,
          operation: "position.delete",
          before: removed,
        });
        await tx
          .delete(transactions)
          .where(
            and(
              eq(transactions.portfolioId, portfolioId),
              eq(transactions.assetId, assetId),
            ),
          );
        await tx
          .delete(positions)
          .where(eq(positions.portfolioId, portfolioId));
        if (projection.holdings.length)
          await tx.insert(positions).values(
            projection.holdings.map((h) => ({
              portfolioId,
              assetId: h.assetId,
              quantity: h.quantity,
              costBasis: h.costBasis,
              realizedPnl: h.realizedPnl,
            })),
          );
        await tx
          .update(portfolios)
          .set({
            revision: sql`${portfolios.revision} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(portfolios.id, portfolioId));
        await tx
          .delete(snapshots)
          .where(
            and(
              eq(snapshots.portfolioId, portfolioId),
              gte(
                snapshots.capturedAt,
                new Date(
                  Math.min(...removed.map((t) => t.occurredAt.getTime())),
                ),
              ),
            ),
          );
      });
    },
    async deleteTransaction(
      portfolioId: string,
      id: string,
      expectedRevision: number,
    ) {
      idSchema.parse(id);
      await owned(portfolioId);
      return db.transaction(async (tx) => {
        const [portfolio] = await tx
          .select()
          .from(portfolios)
          .where(
            and(eq(portfolios.id, portfolioId), eq(portfolios.userId, userId)),
          )
          .for("update");
        if (!portfolio) throw new AccessError();
        if (portfolio.revision !== expectedRevision)
          throw new Error("STALE_REVISION");
        const rows = await tx
          .select()
          .from(transactions)
          .where(eq(transactions.portfolioId, portfolioId));
        const old = rows.find((t) => t.id === id);
        if (!old) throw new AccessError();
        const projection = replayLedger(
          rows.filter((t) => t.id !== id).map(toLedger),
        );
        await tx.insert(audits).values({
          portfolioId,
          userId,
          operation: "transaction.delete",
          before: old,
        });
        await tx
          .delete(transactions)
          .where(
            and(
              eq(transactions.id, id),
              eq(transactions.portfolioId, portfolioId),
            ),
          );
        await tx
          .delete(positions)
          .where(eq(positions.portfolioId, portfolioId));
        if (projection.holdings.length)
          await tx.insert(positions).values(
            projection.holdings.map((h) => ({
              portfolioId,
              assetId: h.assetId,
              quantity: h.quantity,
              costBasis: h.costBasis,
              realizedPnl: h.realizedPnl,
            })),
          );
        await tx
          .update(portfolios)
          .set({
            revision: sql`${portfolios.revision} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(portfolios.id, portfolioId));
        await tx
          .delete(snapshots)
          .where(
            and(
              eq(snapshots.portfolioId, portfolioId),
              gte(snapshots.capturedAt, old.occurredAt),
            ),
          );
      });
    },
  };
}
