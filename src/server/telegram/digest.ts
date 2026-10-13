import "server-only";
import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
} from "drizzle-orm";
import { getDb, type Database } from "@/server/db";
import {
  assets,
  telegramConnections,
  telegramDigests,
  portfolios,
  transactions,
  snapshots,
} from "@/server/db/schema";
import { toLedger } from "@/server/services/portfolio";
import { replayLedger } from "@/domain/ledger";
import { valuePortfolio } from "@/domain/valuation";
import { dailyChange } from "@/domain/daily-change";
import { decimal } from "@/domain/decimal";
import { getQuotes } from "@/server/market";
import { isCurrentDigest, formatDailyDigest } from "./digest-format";
import {
  sendTelegram,
  telegramConfigured,
  TelegramError,
  appOrigin,
} from "./api";

export function digestClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tbilisi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    day: `${value("year")}-${value("month")}-${value("day")}`,
    hour: Number(value("hour")),
  };
}

/** A day is reserved once even after preferences, connection identity or retries change. */
export async function enqueueDailyDigests(
  db: Database = getDb(),
  now = new Date(),
) {
  const clock = digestClock(now);
  await db
    .delete(telegramDigests)
    .where(
      lt(telegramDigests.createdAt, new Date(now.getTime() - 7 * 86400000)),
    );
  const connections = await db
    .select()
    .from(telegramConnections)
    .where(
      and(
        eq(telegramConnections.summaryEnabled, true),
        isNotNull(telegramConnections.chatId),
        lte(telegramConnections.summaryHour, clock.hour),
      ),
    );
  for (const connection of connections) {
    if (
      connection.lastError === "BOT_BLOCKED" ||
      !connection.portfolioIds.length ||
      connection.portfolioIds.length > 10
    )
      continue;
    const owned = await db
      .select({ id: portfolios.id })
      .from(portfolios)
      .where(
        and(
          eq(portfolios.userId, connection.userId),
          inArray(portfolios.id, connection.portfolioIds),
        ),
      );
    if (!owned.length) continue;
    await db
      .insert(telegramDigests)
      .values({
        userId: connection.userId,
        generation: connection.generation,
        day: clock.day,
        portfolioIds: owned.map((p) => p.id),
        nextAttemptAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
  }
}

type Connection = typeof telegramConnections.$inferSelect;
type Job = typeof telegramDigests.$inferSelect;
/** Explicit user-requested test; never reserves or changes the scheduled daily job. */
export async function sendTestDailyDigest(db: Database, userId: string) {
  const [connection] = await db
    .select()
    .from(telegramConnections)
    .where(eq(telegramConnections.userId, userId));
  if (!connection?.chatId) throw new Error("TELEGRAM_NOT_CONNECTED");
  if (connection.lastError === "BOT_BLOCKED")
    throw new Error("TELEGRAM_BOT_BLOCKED");
  if (!connection.portfolioIds.length || connection.portfolioIds.length > 10)
    throw new Error("DIGEST_PORTFOLIOS_INVALID");
  const now = new Date();
  const job: Job = {
    id: randomUUID(),
    userId,
    generation: connection.generation,
    day: digestClock(now).day,
    portfolioIds: connection.portfolioIds,
    body: null,
    attempts: 0,
    nextAttemptAt: now,
    sentAt: null,
    lastError: null,
    createdAt: now,
    updatedAt: now,
  };
  const body = formatDailyDigest(await collectDailyDigest(db, job, now));
  const [latest] = await db
    .select()
    .from(telegramConnections)
    .where(eq(telegramConnections.userId, userId));
  if (
    !latest ||
    latest.chatId !== connection.chatId ||
    latest.generation !== connection.generation ||
    latest.lastError === "BOT_BLOCKED" ||
    !job.portfolioIds.every((id) => latest.portfolioIds.includes(id))
  )
    throw new Error("DIGEST_CANCELLED");
  await sendTelegram(
    connection.chatId,
    `სატესტო ანგარიში\n\n${body}`,
    `${appOrigin()}/portfolios`,
    "პორტფელების ნახვა",
    { parseMode: "HTML" },
  );
}
function consentMatches(connection: Connection | undefined, job: Job) {
  return Boolean(
    connection?.chatId &&
    connection.summaryEnabled &&
    connection.generation === job.generation &&
    connection.lastError !== "BOT_BLOCKED" &&
    job.portfolioIds.every((id) => connection.portfolioIds.includes(id)),
  );
}

export async function collectDailyDigest(db: Database, job: Job, now: Date) {
  const selected = await db
    .select()
    .from(portfolios)
    .where(
      and(
        eq(portfolios.userId, job.userId),
        inArray(portfolios.id, job.portfolioIds),
      ),
    );
  if (selected.length !== job.portfolioIds.length)
    throw new Error("DIGEST_CANCELLED");
  const entries = await db
    .select()
    .from(transactions)
    .where(
      and(
        inArray(transactions.portfolioId, job.portfolioIds),
        lte(transactions.occurredAt, now),
      ),
    )
    .orderBy(asc(transactions.occurredAt), asc(transactions.sequence));
  const ids = [
    ...new Set(entries.flatMap((e) => [e.assetId, e.settlementAssetId])),
  ];
  const allAssets = ids.length
    ? await db.select().from(assets).where(inArray(assets.id, ids))
    : [];
  const ledgerById = new Map(
    selected.map((p) => [
      p.id,
      replayLedger(entries.filter((e) => e.portfolioId === p.id).map(toLedger)),
    ]),
  );
  const held = allAssets.filter((a) =>
    [...ledgerById.values()].some((l) =>
      l.holdings.some((h) => h.assetId === a.id && decimal(h.quantity).gt(0)),
    ),
  );
  const quotes = await getQuotes(held, { mode: "blocking" });
  const start = new Date(`${job.day}T00:00:00+04:00`);
  const baselines = await db
    .select()
    .from(snapshots)
    .where(
      and(
        inArray(snapshots.portfolioId, job.portfolioIds),
        gte(snapshots.capturedAt, start),
        lte(
          snapshots.capturedAt,
          new Date(Math.min(now.getTime(), start.getTime() + 3600000)),
        ),
      ),
    );
  return {
    day: job.day,
    preparedAt: now,
    portfolios: selected.map((p) => {
      const summary = valuePortfolio(ledgerById.get(p.id)!, allAssets, quotes);
      const baseline = baselines
        .filter((s) => s.portfolioId === p.id)
        .sort(
          (a, b) =>
            Math.abs(a.capturedAt.getTime() - start.getTime()) -
            Math.abs(b.capturedAt.getTime() - start.getTime()),
        )[0];
      return {
        id: p.id,
        name: p.name,
        summary,
        change: dailyChange(
          summary,
          baseline,
          entries.filter((e) => e.portfolioId === p.id).map(toLedger),
          start,
          now,
        ),
      };
    }),
  };
}
export async function processDailyDigests(
  db: Database = getDb(),
  now = new Date(),
) {
  if (!telegramConfigured()) return { sent: 0, failed: 0 };
  await enqueueDailyDigests(db, now);
  const jobs = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(telegramDigests)
      .where(
        and(
          isNull(telegramDigests.sentAt),
          lt(telegramDigests.attempts, 5),
          lte(telegramDigests.nextAttemptAt, now),
        ),
      )
      .orderBy(asc(telegramDigests.createdAt))
      .limit(1)
      .for("update", { skipLocked: true });
    for (const row of rows)
      await tx
        .update(telegramDigests)
        .set({ nextAttemptAt: new Date(now.getTime() + 300000) })
        .where(eq(telegramDigests.id, row.id));
    return rows;
  });
  let sent = 0,
    failed = 0;
  for (const job of jobs) {
    const [connection] = await db
      .select()
      .from(telegramConnections)
      .where(eq(telegramConnections.userId, job.userId));
    if (
      !consentMatches(connection, job) ||
      digestClock(now).day !== job.day ||
      now.getTime() - job.createdAt.getTime() > 6 * 3600000
    ) {
      await db
        .update(telegramDigests)
        .set({ attempts: 5, lastError: "CANCELLED", updatedAt: now })
        .where(eq(telegramDigests.id, job.id));
      continue;
    }
    try {
      const body = isCurrentDigest(job.body)
        ? job.body!
        : formatDailyDigest(await collectDailyDigest(db, job, now));
      const [latest] = await db
        .select()
        .from(telegramConnections)
        .where(eq(telegramConnections.userId, job.userId));
      if (!consentMatches(latest, job)) throw new Error("DIGEST_CANCELLED");
      const owned = await db
        .select({ id: portfolios.id })
        .from(portfolios)
        .where(
          and(
            eq(portfolios.userId, job.userId),
            inArray(portfolios.id, job.portfolioIds),
          ),
        );
      if (owned.length !== job.portfolioIds.length)
        throw new Error("DIGEST_CANCELLED");
      const ready = await db
        .update(telegramDigests)
        .set({ body })
        .where(
          and(
            eq(telegramDigests.id, job.id),
            lt(telegramDigests.attempts, 5),
            isNull(telegramDigests.sentAt),
          ),
        )
        .returning({ id: telegramDigests.id });
      if (!ready.length) continue;
      await sendTelegram(
        latest.chatId!,
        body,
        `${appOrigin()}/portfolios`,
        "პორტფელების ნახვა",
        { parseMode: "HTML" },
      );
      await db
        .update(telegramDigests)
        .set({
          sentAt: new Date(),
          attempts: job.attempts + 1,
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(telegramDigests.id, job.id));
      sent++;
    } catch (error) {
      const cancelled =
        error instanceof Error && error.message === "DIGEST_CANCELLED";
      const blocked = error instanceof TelegramError && error.code === 403;
      await db
        .update(telegramDigests)
        .set({
          attempts: cancelled || blocked ? 5 : job.attempts + 1,
          lastError: cancelled
            ? "CANCELLED"
            : blocked
              ? "BOT_BLOCKED"
              : "DELIVERY_FAILED",
          nextAttemptAt: new Date(
            Date.now() +
              Math.max(
                60000 * 2 ** job.attempts,
                error instanceof TelegramError ? error.retryAfter * 1000 : 0,
              ),
          ),
          updatedAt: new Date(),
        })
        .where(eq(telegramDigests.id, job.id));
      if (blocked)
        await db
          .update(telegramConnections)
          .set({ lastError: "BOT_BLOCKED", updatedAt: new Date() })
          .where(
            and(
              eq(telegramConnections.userId, job.userId),
              eq(telegramConnections.generation, job.generation),
            ),
          );
      failed++;
    }
  }
  return { sent, failed };
}
