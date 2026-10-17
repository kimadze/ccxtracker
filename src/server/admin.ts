import "server-only";
import { and, count, desc, eq, gte, isNull, sql, notLike } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "./db";
import {
  adminControls,
  adminEvents,
  aiUsage,
  users,
  suspendedUsers,
  sessions,
  jobState,
  marketQuotes,
  blobCleanupJobs,
  telegramDeliveries,
  telegramDigests,
  takeProfitDeliveries,
  telegramConnections,
} from "./db/schema";
import { isAdmin } from "./admin-access";
import { telegramQueueHealth } from "./telegram/queue";

export type AdminActor = { id: string; email: string; emailVerified: boolean };
const controlsSchema = z.object({
  aiEnabled: z.boolean(),
  userDailyLimit: z.number().int().min(1).max(100),
  globalDailyLimit: z.number().int().min(1).max(5000),
});

export function adminService(db: Database, actor: AdminActor) {
  if (!isAdmin(actor)) throw new Error("ADMIN_FORBIDDEN");
  return {
    async dashboard() {
      const now = new Date(),
        since = new Date(now.getTime() - 86400000);
      const [jobs, quotes, blobs, settings, usage, totals, events, queue] =
        await Promise.all([
          db
            .select({
              key: jobState.key,
              cursor: jobState.cursor,
              updatedAt: jobState.updatedAt,
              leaseUntil: jobState.leaseUntil,
            })
            .from(jobState)
            .where(
              and(
                notLike(jobState.key, "market-pending:%"),
                notLike(jobState.key, "snapshot-retry:%"),
              ),
            ),
          db
            .select({
              total: count(),
              latest: sql<Date | null>`max(${marketQuotes.fetchedAt})`,
              stale: sql<number>`count(*) filter (where ${marketQuotes.quotedAt} < ${new Date(now.getTime() - 15 * 60000)})::int`,
            })
            .from(marketQuotes),
          db
            .select({
              total: count(),
              failed: sql<number>`count(*) filter (where ${blobCleanupJobs.attempts} > 0)::int`,
            })
            .from(blobCleanupJobs),
          db
            .select()
            .from(adminControls)
            .where(eq(adminControls.key, "global")),
          db
            .select({
              requests: count(),
              failed: sql<number>`count(*) filter (where ${aiUsage.status} = 'failed')::int`,
              cost: sql<string | null>`sum(${aiUsage.estimatedCost})::text`,
              unknown: sql<number>`count(*) filter (where ${aiUsage.estimatedCost} is null)::int`,
            })
            .from(aiUsage)
            .where(gte(aiUsage.createdAt, since)),
          db.select({ total: count() }).from(users),
          db
            .select({
              id: adminEvents.id,
              actorId: adminEvents.actorId,
              action: adminEvents.action,
              targetId: adminEvents.targetId,
              createdAt: adminEvents.createdAt,
            })
            .from(adminEvents)
            .orderBy(desc(adminEvents.createdAt))
            .limit(30),
          telegramQueueHealth(db),
        ]);
      return {
        preparedAt: now,
        jobs,
        queue,
        quotes: quotes[0],
        blobs: blobs[0],
        controls: settings[0] ?? {
          aiEnabled: true,
          userDailyLimit: 20,
          globalDailyLimit: 300,
        },
        usage: usage[0],
        users: totals[0].total,
        events,
      };
    },
    async notifications() {
      const [watch, digest, tp] = await Promise.all([
        db
          .select({
            id: telegramDeliveries.id,
            attempts: telegramDeliveries.attempts,
            sentAt: telegramDeliveries.sentAt,
            createdAt: telegramDeliveries.createdAt,
            nextAttemptAt: telegramDeliveries.nextAttemptAt,
            lastError: telegramDeliveries.lastError,
          })
          .from(telegramDeliveries)
          .orderBy(desc(telegramDeliveries.createdAt))
          .limit(50),
        db
          .select({
            id: telegramDigests.id,
            attempts: telegramDigests.attempts,
            sentAt: telegramDigests.sentAt,
            createdAt: telegramDigests.createdAt,
            nextAttemptAt: telegramDigests.nextAttemptAt,
            lastError: telegramDigests.lastError,
          })
          .from(telegramDigests)
          .orderBy(desc(telegramDigests.createdAt))
          .limit(50),
        db
          .select({
            id: takeProfitDeliveries.id,
            attempts: takeProfitDeliveries.attempts,
            sentAt: takeProfitDeliveries.sentAt,
            createdAt: takeProfitDeliveries.createdAt,
            nextAttemptAt: takeProfitDeliveries.nextAttemptAt,
          })
          .from(takeProfitDeliveries)
          .orderBy(desc(takeProfitDeliveries.createdAt))
          .limit(50),
      ]);
      return [
        ...watch.map((r) => ({ ...r, kind: "watchlist" as const })),
        ...digest.map((r) => ({ ...r, kind: "digest" as const })),
        ...tp.map((r) => ({
          ...r,
          kind: "take-profit" as const,
          lastError: null,
        })),
      ]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 50);
    },
    async members(page = 1) {
      const offset = (z.number().int().min(1).max(10000).parse(page) - 1) * 20;
      return db
        .select({
          id: users.id,
          email: users.email,
          emailVerified: users.emailVerified,
          name: users.name,
          createdAt: users.createdAt,
          suspended: suspendedUsers.userId,
        })
        .from(users)
        .leftJoin(suspendedUsers, eq(users.id, suspendedUsers.userId))
        .orderBy(desc(users.createdAt), users.id)
        .limit(20)
        .offset(offset);
    },
    async controls(input: unknown) {
      const data = controlsSchema.parse(input);
      await db.transaction(async (tx) => {
        await tx
          .insert(adminControls)
          .values({ key: "global", ...data })
          .onConflictDoUpdate({
            target: adminControls.key,
            set: { ...data, updatedAt: new Date() },
          });
        await tx
          .insert(adminEvents)
          .values({ actorId: actor.id, action: "ai-controls", details: data });
      });
    },
    async suspend(input: unknown) {
      const { userId, suspended } = z
        .object({ userId: z.string().min(1).max(200), suspended: z.boolean() })
        .parse(input);
      await db.transaction(async (tx) => {
        const [target] = await tx
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .for("update");
        if (!target || isAdmin(target) || target.id === actor.id)
          throw new Error("ADMIN_PROTECTED");
        if (suspended) {
          await tx
            .insert(suspendedUsers)
            .values({ userId })
            .onConflictDoNothing();
          await tx.delete(sessions).where(eq(sessions.userId, userId));
          // Reconnection is explicit after restoration; never replay old jobs.
          await tx
            .delete(telegramConnections)
            .where(eq(telegramConnections.userId, userId));
          await tx
            .update(telegramDigests)
            .set({ attempts: 5, lastError: "CANCELLED", body: null })
            .where(
              and(
                eq(telegramDigests.userId, userId),
                isNull(telegramDigests.sentAt),
              ),
            );
        } else
          await tx
            .delete(suspendedUsers)
            .where(eq(suspendedUsers.userId, userId));
        await tx.insert(adminEvents).values({
          actorId: actor.id,
          action: suspended ? "user-suspended" : "user-restored",
          targetId: userId,
          details: {},
        });
      });
    },
    async retry(input: unknown) {
      const { id, kind } = z
        .object({
          id: z.uuid(),
          kind: z.enum(["watchlist", "digest", "take-profit"]),
        })
        .parse(input);
      const table =
        kind === "watchlist"
          ? telegramDeliveries
          : kind === "digest"
            ? telegramDigests
            : takeProfitDeliveries;
      await db.transaction(async (tx) => {
        const now = new Date();
        const [row] = await tx
          .select()
          .from(table)
          .where(eq(table.id, id))
          .for("update");
        if (
          !row ||
          row.sentAt ||
          !row.attempts ||
          row.nextAttemptAt > now ||
          now.getTime() - row.createdAt.getTime() > 6 * 3600000 ||
          ("lastError" in row &&
            [
              "CANCELLED",
              "BOT_BLOCKED",
              "PREFERENCES_CHANGED",
              "TELEGRAM_403",
              "EXPIRED",
            ].includes(row.lastError ?? ""))
        )
          throw new Error("RETRY_UNAVAILABLE");
        await tx
          .update(table)
          .set({ attempts: 0, nextAttemptAt: now, updatedAt: now })
          .where(and(eq(table.id, id), isNull(table.sentAt)));
        await tx.insert(adminEvents).values({
          actorId: actor.id,
          action: "notification-retry",
          targetId: id,
          details: { kind },
        });
      });
    },
  };
}
