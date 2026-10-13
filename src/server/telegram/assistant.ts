import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/server/db";
import {
  assets,
  exitLevels,
  exitPlans,
  portfolios,
  telegramConnections,
} from "@/server/db/schema";
import { portfolioService } from "@/server/services/portfolio";
import { consumeRateLimit } from "@/server/rate-limit";
import { replayLedger } from "@/domain/ledger";
import { parseTelegramCommand } from "@/domain/telegram-command";
import { quantity, unitPrice } from "@/lib/formatters";
import { sendTelegram } from "./api";

const update = z.object({
  update_id: z.number().int().nonnegative().safe(),
  message: z.object({
    date: z.number().int().positive(),
    text: z.string().max(256),
    chat: z.object({
      id: z.number().int().positive().safe(),
      type: z.literal("private"),
    }),
    from: z.object({
      id: z.number().int().positive().safe(),
      is_bot: z.literal(false),
    }),
  }),
});
const help =
  "პორტფელის ასისტენტი\n\n/position XLM — რაოდენობა\n/plan STRK — გაყიდვის გეგმა\n\nასევე: „რამდენი XLM მაქვს?“ ან „მაჩვენე STRK-ის გაყიდვის გეგმა“.\nმხოლოდ Telegram-ში არჩეული ხელით სამართავი პორტფელები. მონაცემები არ იცვლება.";

export async function replyTelegramAssistant(db: Database, input: unknown) {
  const parsed = update.safeParse(input);
  if (!parsed.success) return;
  const { message, update_id } = parsed.data;
  if (message.chat.id !== message.from.id || /^\/start\s/.test(message.text))
    return;
  const age = Date.now() / 1000 - message.date;
  if (age > 300 || age < -60) return;
  const rows = await db
    .select()
    .from(telegramConnections)
    .where(eq(telegramConnections.chatId, String(message.chat.id)));
  // An ambiguous/shared chat must never disclose either user's financial data.
  if (rows.length !== 1 || rows[0].lastError === "BOT_BLOCKED") return;
  const connection = rows[0];
  if (
    !(await consumeRateLimit(
      `telegram-assistant:${connection.userId}`,
      10,
      60000,
    ))
  )
    return;
  if (
    !(await consumeRateLimit(
      `telegram-assistant-update:${update_id}`,
      1,
      86400000,
    ))
  )
    return;
  const command = parseTelegramCommand(message.text);
  let body = help;
  if (command && command.kind !== "help") {
    const owned = await db
      .select()
      .from(portfolios)
      .where(
        and(
          eq(portfolios.userId, connection.userId),
          inArray(
            portfolios.id,
            connection.portfolioIds.length
              ? connection.portfolioIds
              : ["00000000-0000-0000-0000-000000000000"],
          ),
        ),
      )
      .orderBy(asc(portfolios.createdAt));
    const matching = (await db.select().from(assets)).filter(
      (a) => a.symbol.toUpperCase() === command.symbol,
    );
    if (matching.length !== 1)
      body = matching.length
        ? "სიმბოლო რამდენიმე აქტივს ეკუთვნის. გახსენით აპი აქტივის ზუსტად ასარჩევად."
        : "აქტივი ვერ მოიძებნა. გადაამოწმეთ სიმბოლო.";
    else {
      const asset = matching[0];
      const sections: string[] = [];
      for (const portfolio of owned.slice(0, 10)) {
        const entries = await portfolioService(db, connection.userId).entries(
          portfolio.id,
        );
        const holding = replayLedger(
          entries.filter((e) => new Date(e.occurredAt).getTime() <= Date.now()),
        ).holdings.find((h) => h.assetId === asset.id);
        if (!holding) continue;
        if (command.kind === "position")
          sections.push(
            `${portfolio.name.slice(0, 100)}\n${quantity(holding.quantity)} ${asset.symbol}`,
          );
        else {
          const [plan] = await db
            .select()
            .from(exitPlans)
            .where(
              and(
                eq(exitPlans.portfolioId, portfolio.id),
                eq(exitPlans.assetId, asset.id),
              ),
            );
          const levels = plan
            ? await db
                .select()
                .from(exitLevels)
                .where(eq(exitLevels.planId, plan.id))
                .orderBy(asc(exitLevels.level))
            : [];
          sections.push(
            `${portfolio.name.slice(0, 100)}\n${quantity(holding.quantity)} ${asset.symbol}\n${
              levels.length
                ? levels
                    .slice(0, 20)
                    .map(
                      (l) =>
                        `TP${l.level} · ${unitPrice(l.price)} · ${quantity(l.percentage)}%${l.reachedAt ? " · მიღწეული" : ""}`,
                    )
                    .join("\n")
                : "გაყიდვის გეგმა არ არის."
            }`,
          );
        }
      }
      body = sections.length
        ? `${asset.symbol}${command.kind === "plan" ? " · გაყიდვის გეგმა" : ""}\n\n${sections.join("\n\n")}\n\n${command.kind === "plan" ? "გეგმაა, არა ბირჟის ორდერი. ავტომატური გაყიდვა არ ხდება." : "აღრიცხული რაოდენობა · ბირჟის ცოცხალი ნაშთი არ არის."}`
        : "არჩეულ ხელით სამართავ პორტფელებში ეს პოზიცია არ არის.";
    }
  }
  const [current] = await db
    .select()
    .from(telegramConnections)
    .where(eq(telegramConnections.userId, connection.userId));
  if (
    !current ||
    current.chatId !== connection.chatId ||
    current.generation !== connection.generation ||
    [...current.portfolioIds].sort().join() !==
      [...connection.portfolioIds].sort().join()
  )
    return;
  await sendTelegram(
    connection.chatId!,
    body.length <= 4000
      ? body
      : "მონაცემები შეტყობინებაში არ ეტევა. სრული გეგმა ნახეთ აპში.",
  );
}
