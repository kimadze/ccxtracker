"use server";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "./auth";
import { getDb, type Database } from "./db";
import {
  assets,
  audits,
  marketQuotes,
  portfolios,
  positions,
  snapshots,
  transactions,
} from "./db/schema";
import { portfolioService, AccessError, toLedger } from "./services/portfolio";
import { idSchema, transactionSchema } from "@/domain/validation";
import { replayLedger } from "@/domain/ledger";
import { TRANSACTION_UNDO_WINDOW_MS } from "@/domain/transaction-policy";
import { transactionImpact } from "@/domain/transaction-impact";
import type { LedgerEntry, Quote } from "@/domain/types";
import { userError } from "./errors";
import { revalidatePath } from "next/cache";

const batchSchema = z
  .array(transactionSchema)
  .min(1)
  .max(20)
  .superRefine((rows, ctx) => {
    if (
      new Set(rows.map((r) => r.assetId)).size !== rows.length ||
      new Set(rows.map((r) => r.id)).size !== rows.length ||
      rows.some(
        (r) =>
          r.portfolioId !== rows[0].portfolioId ||
          r.assetId === "USD" ||
          r.kind !== "deposit" ||
          r.fee !== "0",
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "აირჩიეთ განსხვავებული აქტივები და შეამოწმეთ მონაცემები.",
      });
  });
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
async function rebuild(
  tx: Tx,
  portfolioId: string,
  entries: LedgerEntry[],
  invalidFrom: Date,
) {
  const projection = replayLedger(entries);
  await tx.delete(positions).where(eq(positions.portfolioId, portfolioId));
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
      revision: sql`GREATEST(${portfolios.revision} + 1, ${Math.max(0, ...entries.map((e) => e.sequence))})`,
      updatedAt: new Date(),
    })
    .where(eq(portfolios.id, portfolioId));
  await tx
    .delete(snapshots)
    .where(
      and(
        eq(snapshots.portfolioId, portfolioId),
        gte(snapshots.capturedAt, invalidFrom),
      ),
    );
}
export async function previewTransactionChange(
  portfolioId: string,
  revision: number,
  operation: "create" | "update" | "delete" | "batch",
  input: unknown,
) {
  const user = await requireUser();
  try {
    z.enum(["create", "update", "delete", "batch"]).parse(operation);
    z.number().int().nonnegative().parse(revision);
    await portfolioService(getDb(), user.id).owned(portfolioId);
    const impact = await getDb().transaction(async (tx) => {
      const [portfolio] = await tx
        .select()
        .from(portfolios)
        .where(
          and(eq(portfolios.id, portfolioId), eq(portfolios.userId, user.id)),
        )
        .for("share");
      if (!portfolio) throw new AccessError();
      if (portfolio.revision !== revision) throw new Error("STALE_REVISION");
      const before = (
        await tx
          .select()
          .from(transactions)
          .where(eq(transactions.portfolioId, portfolioId))
      ).map(toLedger);
      let after: LedgerEntry[], changed: string[];
      if (operation === "delete") {
        const id = idSchema.parse(input),
          old = before.find((t) => t.id === id);
        if (!old) throw new AccessError();
        after = before.filter((t) => t.id !== id);
        changed = [old.assetId];
      } else {
        const parsed =
          operation === "batch"
            ? batchSchema.parse(input)
            : [transactionSchema.parse(input)];
        if (parsed.some((t) => t.portfolioId !== portfolioId))
          throw new AccessError();
        if (
          operation === "update" &&
          !before.some((t) => t.id === parsed[0].id)
        )
          throw new AccessError();
        const max = Math.max(
          portfolio.revision,
          ...before.map((t) => t.sequence),
        );
        after = [
          ...before.filter((t) => !parsed.some((p) => p.id === t.id)),
          ...parsed.map((t, i) => ({
            ...t,
            sequence:
              before.find((old) => old.id === t.id)?.sequence ?? max + i + 1,
          })),
        ];
        changed = [
          ...parsed.map((t) => t.assetId),
          ...before
            .filter((t) => parsed.some((p) => p.id === t.id))
            .map((t) => t.assetId),
        ];
      }
      const allAssets = await tx.select().from(assets);
      const cached = await tx.select().from(marketQuotes);
      const quotes: Quote[] = cached.map((q) => ({
        assetId: q.assetId,
        price: q.price,
        change24h: q.change24h,
        updatedAt: q.quotedAt.toISOString(),
        stale: Date.now() - q.quotedAt.getTime() > 900000,
      }));
      return transactionImpact(before, after, allAssets, quotes, changed);
    });
    return { ok: true as const, impact };
  } catch (error) {
    return { ok: false as const, error: userError(error) };
  }
}
export async function saveOpeningAssets(input: unknown, revision: number) {
  const user = await requireUser();
  try {
    z.number().int().nonnegative().parse(revision);
    const rows = batchSchema.parse(input),
      portfolioId = rows[0].portfolioId;
    const result = await getDb().transaction(async (tx) => {
      const [portfolio] = await tx
        .select()
        .from(portfolios)
        .where(
          and(eq(portfolios.id, portfolioId), eq(portfolios.userId, user.id)),
        )
        .for("update");
      if (!portfolio) throw new AccessError();
      const existing = await tx
        .select()
        .from(transactions)
        .where(eq(transactions.portfolioId, portfolioId));
      const matches = rows.filter((r) => existing.some((t) => t.id === r.id));
      if (matches.length === rows.length)
        return { revision: portfolio.revision };
      if (matches.length || portfolio.revision !== revision)
        throw new Error("STALE_REVISION");
      const known = await tx
        .select({ id: assets.id })
        .from(assets)
        .where(
          inArray(
            assets.id,
            rows.map((r) => r.assetId),
          ),
        );
      if (known.length !== rows.length) throw new Error("UNKNOWN_ASSET");
      const sequence = Math.max(
        portfolio.revision,
        ...existing.map((t) => t.sequence),
      );
      const entries = rows.map((r, i) => ({
        ...r,
        sequence: sequence + i + 1,
      }));
      replayLedger([...existing.map(toLedger), ...entries]);
      await tx
        .insert(transactions)
        .values(
          entries.map((r) => ({ ...r, occurredAt: new Date(r.occurredAt) })),
        );
      await rebuild(
        tx,
        portfolioId,
        [...existing.map(toLedger), ...entries],
        new Date(Math.min(...rows.map((r) => Date.parse(r.occurredAt)))),
      );
      return {
        revision: Math.max(portfolio.revision + 1, sequence + rows.length),
      };
    });
    revalidatePath("/portfolios", "layout");
    return { ok: true as const, ...result };
  } catch (error) {
    return { ok: false as const, error: userError(error) };
  }
}
export async function restoreTransaction(portfolioId: string, undoId: string) {
  const user = await requireUser();
  try {
    idSchema.parse(undoId);
    await getDb().transaction(async (tx) => {
      const [portfolio] = await tx
        .select()
        .from(portfolios)
        .where(
          and(eq(portfolios.id, portfolioId), eq(portfolios.userId, user.id)),
        )
        .for("update");
      if (!portfolio) throw new AccessError();
      const [audit] = await tx
        .select()
        .from(audits)
        .where(
          and(
            eq(audits.id, undoId),
            eq(audits.portfolioId, portfolioId),
            eq(audits.userId, user.id),
          ),
        )
        .for("update");
      if (
        !audit ||
        !["transaction.delete", "transaction.restored"].includes(
          audit.operation,
        )
      )
        throw new AccessError();
      if (audit.operation === "transaction.restored") return;
      if (Date.now() - audit.createdAt.getTime() > TRANSACTION_UNDO_WINDOW_MS)
        throw new Error("UNDO_EXPIRED");
      const original = audit.before as typeof transactions.$inferSelect;
      if (original.portfolioId !== portfolioId) throw new AccessError();
      const parsed = transactionSchema.parse({
        ...original,
        airdropSource: original.airdropSource ?? "",
        airdropNetwork: original.airdropNetwork ?? "",
        occurredAt: new Date(original.occurredAt).toISOString(),
      });
      const existing = await tx
        .select()
        .from(transactions)
        .where(eq(transactions.portfolioId, portfolioId));
      if (
        existing.some(
          (t) => t.id === parsed.id || t.sequence === original.sequence,
        )
      )
        throw new Error("STALE_REVISION");
      const entry = { ...parsed, sequence: original.sequence };
      replayLedger([...existing.map(toLedger), entry]);
      await tx.insert(transactions).values({
        ...entry,
        airdropSource: original.airdropSource,
        airdropNetwork: original.airdropNetwork,
        occurredAt: new Date(entry.occurredAt),
        createdAt: new Date(original.createdAt),
        updatedAt: new Date(original.updatedAt),
      });
      await rebuild(
        tx,
        portfolioId,
        [...existing.map(toLedger), entry],
        new Date(entry.occurredAt),
      );
      await tx
        .update(audits)
        .set({ operation: "transaction.restored" })
        .where(eq(audits.id, undoId));
    });
    revalidatePath("/portfolios", "layout");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: userError(error) };
  }
}
