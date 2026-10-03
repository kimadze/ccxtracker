import "server-only";
import { and, asc, eq, isNull, lt, or, sql } from "drizzle-orm";
import type { Database } from "@/server/db";
import { walletPortfolios } from "@/server/db/schema";
import { idSchema } from "@/domain/validation";
import { walletInputSchema } from "@/server/wallet-validation";
import { fetchWalletSnapshot } from "@/server/wallet-provider";
import { AccessError } from "./portfolio";

export function walletService(
  db: Database,
  userId: string,
  load = fetchWalletSnapshot,
) {
  if (!userId) throw new AccessError();
  async function owned(id: string) {
    idSchema.parse(id);
    const [row] = await db
      .select()
      .from(walletPortfolios)
      .where(
        and(eq(walletPortfolios.id, id), eq(walletPortfolios.userId, userId)),
      );
    if (!row) throw new AccessError();
    return row;
  }
  return {
    owned,
    list: () =>
      db
        .select()
        .from(walletPortfolios)
        .where(eq(walletPortfolios.userId, userId))
        .orderBy(asc(walletPortfolios.createdAt)),
    async create(input: unknown) {
      const data = walletInputSchema.parse(input);
      const [row] = await db
        .insert(walletPortfolios)
        .values({
          userId,
          name: data.name,
          network: data.network,
          config: {
            addresses: data.addresses.map((a) =>
              data.network === "bitcoin" && /^bc1/i.test(a)
                ? a.toLowerCase()
                : a,
            ),
          },
        })
        .returning();
      return row;
    },
    async update(id: string, input: unknown) {
      const data = walletInputSchema.parse(input);
      const p = await owned(id);
      if (p.network !== data.network) throw Error("WALLET_NETWORK_IMMUTABLE");
      await db
        .update(walletPortfolios)
        .set({
          name: data.name,
          config: {
            addresses: data.addresses.map((a) =>
              data.network === "bitcoin" && /^bc1/i.test(a)
                ? a.toLowerCase()
                : a,
            ),
          },
          snapshot: null,
          lastError: null,
          lastAttemptAt: null,
          updatedAt: new Date(),
        })
        .where(
          and(eq(walletPortfolios.id, id), eq(walletPortfolios.userId, userId)),
        );
    },
    async remove(id: string) {
      await owned(id);
      await db
        .delete(walletPortfolios)
        .where(
          and(eq(walletPortfolios.id, id), eq(walletPortfolios.userId, userId)),
        );
    },
    async refresh(id: string) {
      const p = await owned(id);
      const now = new Date();
      const [claim] = await db
        .update(walletPortfolios)
        .set({ lastAttemptAt: now })
        .where(
          and(
            eq(walletPortfolios.id, id),
            eq(walletPortfolios.userId, userId),
            sql`date_trunc('milliseconds', ${walletPortfolios.updatedAt}) = ${p.updatedAt.toISOString()}::timestamptz`,
            or(
              isNull(walletPortfolios.lastAttemptAt),
              lt(
                walletPortfolios.lastAttemptAt,
                new Date(now.getTime() - 60000),
              ),
            ),
          ),
        )
        .returning();
      if (!claim) throw Error("WALLET_REFRESH_LIMIT");
      try {
        const snapshot = await load(p.network, p.config.addresses);
        await db
          .update(walletPortfolios)
          .set({ snapshot, lastError: null })
          .where(
            and(
              eq(walletPortfolios.id, id),
              eq(walletPortfolios.userId, userId),
              sql`date_trunc('milliseconds', ${walletPortfolios.updatedAt}) = ${p.updatedAt.toISOString()}::timestamptz`,
              eq(walletPortfolios.lastAttemptAt, now),
            ),
          );
        return snapshot;
      } catch (error) {
        await db
          .update(walletPortfolios)
          .set({
            lastError: "ბალანსი ვერ განახლდა. წინა მონაცემები შენარჩუნებულია.",
          })
          .where(
            and(
              eq(walletPortfolios.id, id),
              eq(walletPortfolios.userId, userId),
              sql`date_trunc('milliseconds', ${walletPortfolios.updatedAt}) = ${p.updatedAt.toISOString()}::timestamptz`,
              eq(walletPortfolios.lastAttemptAt, now),
            ),
          );
        throw error;
      }
    },
  };
}
