import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, isNull, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/server/db";
import {
  telegramConnections,
  telegramDeliveries,
  telegramDigests,
  portfolios,
  jobState,
  takeProfitDeliveries,
  exitPlans,
} from "@/server/db/schema";
import { telegramConfigured, sendTelegram, appOrigin } from "./api";
import { aiConfigured } from "@/server/ai/client";
export const hashLink = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export function telegramService(db: Database, userId: string) {
  return {
    async status() {
      const [row] = await db
        .select()
        .from(telegramConnections)
        .where(eq(telegramConnections.userId, userId));
      const owned = await db
        .select({ id: portfolios.id, name: portfolios.name })
        .from(portfolios)
        .where(eq(portfolios.userId, userId));
      const [health] = await db
        .select()
        .from(jobState)
        .where(eq(jobState.key, "watchlist-health"));
      return {
        configured: telegramConfigured(),
        connected: Boolean(row?.chatId),
        username: row?.username ?? null,
        awaitingConfirmation: Boolean(
          row?.pendingChatId &&
          row.linkExpiresAt &&
          row.linkExpiresAt.getTime() > Date.now(),
        ),
        pendingUsername: row?.pendingUsername ?? null,
        buyEnabled: row?.buyEnabled ?? true,
        sellEnabled: row?.sellEnabled ?? true,
        summaryEnabled: row?.summaryEnabled ?? false,
        summaryAiEnabled: row?.summaryAiEnabled ?? false,
        summaryHour: row?.summaryHour ?? 21,
        aiConfigured: aiConfigured(),
        portfolioIds: row?.portfolioIds ?? [],
        portfolios: owned,
        lastError: row?.lastError ?? null,
        monitoringDelayed: Boolean(
          row?.chatId &&
          (!health ||
            health.leaseUntil.getTime() === 0 ||
            Date.now() - health.leaseUntil.getTime() > 15 * 60000),
        ),
        lastMonitorAt: health?.updatedAt.toISOString() ?? null,
      };
    },
    async begin(portfolioId: string) {
      if (!telegramConfigured()) throw new Error("TELEGRAM_NOT_CONFIGURED");
      const [owned] = await db
        .select()
        .from(portfolios)
        .where(
          and(eq(portfolios.id, portfolioId), eq(portfolios.userId, userId)),
        );
      if (!owned) throw new Error("RESOURCE_NOT_FOUND");
      const token = randomBytes(32).toString("base64url"),
        values = {
          linkHash: hashLink(token),
          linkExpiresAt: new Date(Date.now() + 600000),
          pendingChatId: null,
          pendingUsername: null,
          updatedAt: new Date(),
        };
      await db
        .insert(telegramConnections)
        .values({ userId, portfolioIds: [portfolioId], ...values })
        .onConflictDoUpdate({
          target: telegramConnections.userId,
          set: values,
        });
      return {
        url: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=${token}`,
      };
    },
    async confirm() {
      await db.transaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(telegramConnections)
          .where(eq(telegramConnections.userId, userId))
          .for("update");
        if (
          !row?.pendingChatId ||
          !row.linkExpiresAt ||
          row.linkExpiresAt.getTime() <= Date.now()
        )
          throw new Error("TELEGRAM_LINK_EXPIRED");
        // The CCX user must verify the Telegram identity before any prices are sent.
        await tx
          .delete(telegramDeliveries)
          .where(eq(telegramDeliveries.userId, userId));
        await tx
          .update(telegramConnections)
          .set({
            generation: randomUUID(),
            chatId: row.pendingChatId,
            username: row.pendingUsername,
            linkHash: null,
            linkExpiresAt: null,
            pendingChatId: null,
            pendingUsername: null,
            lastError: null,
            updatedAt: new Date(),
          })
          .where(eq(telegramConnections.userId, userId));
      });
    },
    async preferences(input: unknown) {
      const data = z
        .object({
          buyEnabled: z.boolean(),
          sellEnabled: z.boolean(),
          summaryEnabled: z.boolean().optional(),
          summaryAiEnabled: z.boolean().optional(),
          summaryHour: z.number().int().min(0).max(23).optional(),
          portfolioIds: z.array(z.uuid()).max(100),
        })
        .parse(input);
      if (
        data.summaryEnabled &&
        (!data.portfolioIds.length || data.portfolioIds.length > 10)
      )
        throw new Error("DIGEST_PORTFOLIOS_INVALID");
      if (data.summaryEnabled && data.summaryAiEnabled && !aiConfigured())
        throw new Error("AI_NOT_CONFIGURED");
      const owned = await db
        .select({ id: portfolios.id })
        .from(portfolios)
        .where(eq(portfolios.userId, userId));
      if (data.portfolioIds.some((id) => !owned.some((p) => p.id === id)))
        throw new Error("RESOURCE_NOT_FOUND");
      await db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(telegramConnections)
          .where(eq(telegramConnections.userId, userId))
          .for("update");
        const changed =
          current &&
          ((data.summaryEnabled !== undefined &&
            data.summaryEnabled !== current.summaryEnabled) ||
            (data.summaryAiEnabled !== undefined &&
              data.summaryAiEnabled !== current.summaryAiEnabled) ||
            (data.summaryHour !== undefined &&
              data.summaryHour !== current.summaryHour) ||
            [...data.portfolioIds].sort().join() !==
              [...current.portfolioIds].sort().join());
        if (changed)
          await tx
            .update(telegramDigests)
            .set({ body: null, attempts: 5, lastError: "PREFERENCES_CHANGED" })
            .where(
              and(
                eq(telegramDigests.userId, userId),
                isNull(telegramDigests.sentAt),
              ),
            );
        await tx
          .update(telegramConnections)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(telegramConnections.userId, userId));
      });
    },
    async disconnect() {
      await db
        .update(telegramDigests)
        .set({ body: null, attempts: 5, lastError: "CANCELLED" })
        .where(
          and(
            eq(telegramDigests.userId, userId),
            isNull(telegramDigests.sentAt),
          ),
        );
      await db
        .delete(telegramConnections)
        .where(eq(telegramConnections.userId, userId));
    },
    async retryFailed() {
      const [connection] = await db
        .select()
        .from(telegramConnections)
        .where(eq(telegramConnections.userId, userId));
      if (!connection?.chatId) throw new Error("TELEGRAM_NOT_CONNECTED");
      if (connection.lastError === "BOT_BLOCKED")
        throw new Error("TELEGRAM_BOT_BLOCKED");
      const cutoff = new Date(Date.now() - 6 * 3600000);
      await db.transaction(async (tx) => {
        await tx
          .update(telegramDeliveries)
          .set({
            attempts: 0,
            lastError: null,
            nextAttemptAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(telegramDeliveries.userId, userId),
              eq(telegramDeliveries.generation, connection.generation),
              eq(telegramDeliveries.attempts, 8),
              isNull(telegramDeliveries.sentAt),
              gt(telegramDeliveries.createdAt, cutoff),
            ),
          );
        const plans = await tx
          .select({ id: exitPlans.id })
          .from(exitPlans)
          .innerJoin(portfolios, eq(portfolios.id, exitPlans.portfolioId))
          .where(eq(portfolios.userId, userId));
        if (plans.length)
          await tx
            .update(takeProfitDeliveries)
            .set({
              attempts: 0,
              nextAttemptAt: new Date(),
              updatedAt: new Date(),
            })
            .where(
              and(
                inArray(
                  takeProfitDeliveries.planId,
                  plans.map((p) => p.id),
                ),
                eq(
                  takeProfitDeliveries.connectionGeneration,
                  connection.generation,
                ),
                eq(takeProfitDeliveries.attempts, 8),
                isNull(takeProfitDeliveries.sentAt),
                gt(takeProfitDeliveries.createdAt, cutoff),
              ),
            );
      });
    },
    async test() {
      const [row] = await db
        .select()
        .from(telegramConnections)
        .where(eq(telegramConnections.userId, userId));
      if (!row?.chatId) throw new Error("TELEGRAM_NOT_CONNECTED");
      await sendTelegram(
        row.chatId,
        "სატესტო შეტყობინება\nTelegram-ის კავშირი მუშაობს.",
      );
      await db
        .update(telegramConnections)
        .set({ lastError: null, updatedAt: new Date() })
        .where(
          and(
            eq(telegramConnections.userId, userId),
            eq(telegramConnections.generation, row.generation),
          ),
        );
    },
  };
}
const updateSchema = z.object({
  message: z.object({
    text: z.string().max(256),
    chat: z.object({
      id: z.number().int().positive().safe(),
      type: z.literal("private"),
    }),
    from: z.object({
      id: z.number().int().positive().safe(),
      is_bot: z.literal(false),
      username: z.string().max(64).optional(),
      first_name: z.string().max(64).optional(),
    }),
  }),
});
function parseTelegramStart(input: unknown) {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return null;
  const { message } = parsed.data;
  if (message.from.id !== message.chat.id) return null;
  const match = /^\/start(?:@[A-Za-z0-9_]+)? ([A-Za-z0-9_-]{43})$/.exec(
    message.text,
  );
  if (!match) return null;
  return { message, token: match[1] };
}
export async function acceptTelegramLink(db: Database, input: unknown) {
  const start = parseTelegramStart(input);
  if (!start) return false;
  const { message, token } = start;
  const rows = await db
    .update(telegramConnections)
    .set({
      pendingChatId: String(message.chat.id),
      pendingUsername: message.from.username
        ? `@${message.from.username}`
        : `${message.from.first_name ?? "Telegram"} · ${String(message.chat.id).slice(-4)}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(telegramConnections.linkHash, hashLink(token)),
        gt(telegramConnections.linkExpiresAt, new Date()),
        isNull(telegramConnections.pendingChatId),
      ),
    )
    .returning({ id: telegramConnections.userId });
  return rows.length === 1;
}

/** A generic return instruction only; no alerts until CCX-side confirmation. */
export async function replyTelegramLinkReturn(db: Database, input: unknown) {
  const start = parseTelegramStart(input);
  if (!start) return;
  const [connection] = await db
    .select()
    .from(telegramConnections)
    .where(
      and(
        eq(telegramConnections.linkHash, hashLink(start.token)),
        eq(telegramConnections.pendingChatId, String(start.message.chat.id)),
        gt(telegramConnections.linkExpiresAt, new Date()),
      ),
    );
  if (!connection) return;
  const owned = await db
    .select({ id: portfolios.id })
    .from(portfolios)
    .where(eq(portfolios.userId, connection.userId));
  const portfolio =
    owned.find((p) => connection.portfolioIds.includes(p.id)) ?? owned[0];
  if (!portfolio) return;
  await sendTelegram(
    String(start.message.chat.id),
    "დაბრუნდი CCX-ში და დაადასტურე შენი Telegram ჩატი.",
    `${appOrigin()}/portfolios/${portfolio.id}/settings#settings-telegram`,
    "CCX-ში დაბრუნება",
  );
}
