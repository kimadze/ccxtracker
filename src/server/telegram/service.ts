import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/server/db";
import {
  telegramConnections,
  telegramDeliveries,
  portfolios,
} from "@/server/db/schema";
import { telegramConfigured, sendTelegram } from "./api";
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
        portfolioIds: row?.portfolioIds ?? [],
        portfolios: owned,
        lastError: row?.lastError ?? null,
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
          portfolioIds: z.array(z.uuid()).max(100),
        })
        .parse(input);
      const owned = await db
        .select({ id: portfolios.id })
        .from(portfolios)
        .where(eq(portfolios.userId, userId));
      if (data.portfolioIds.some((id) => !owned.some((p) => p.id === id)))
        throw new Error("RESOURCE_NOT_FOUND");
      await db
        .update(telegramConnections)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(telegramConnections.userId, userId));
    },
    async disconnect() {
      await db
        .delete(telegramConnections)
        .where(eq(telegramConnections.userId, userId));
    },
    async test() {
      const [row] = await db
        .select()
        .from(telegramConnections)
        .where(eq(telegramConnections.userId, userId));
      if (!row?.chatId) throw new Error("TELEGRAM_NOT_CONNECTED");
      await sendTelegram(
        row.chatId,
        "CCX · სატესტო შეტყობინება\nTelegram-ის კავშირი მუშაობს.",
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
export async function acceptTelegramLink(db: Database, input: unknown) {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return false;
  const { message } = parsed.data;
  if (message.from.id !== message.chat.id) return false;
  const match = /^\/start(?:@[A-Za-z0-9_]+)? ([A-Za-z0-9_-]{43})$/.exec(
    message.text,
  );
  if (!match) return false;
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
        eq(telegramConnections.linkHash, hashLink(match[1])),
        gt(telegramConnections.linkExpiresAt, new Date()),
        isNull(telegramConnections.pendingChatId),
      ),
    )
    .returning({ id: telegramConnections.userId });
  return rows.length === 1;
}
