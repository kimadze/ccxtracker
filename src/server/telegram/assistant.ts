import { assistantReport } from "./assistant-report";
import { accountIsActive } from "@/server/account-access";
import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/server/db";
import { telegramConnections } from "@/server/db/schema";
import { consumeRateLimit } from "@/server/rate-limit";
import { parseTelegramCommand } from "@/domain/telegram-command";
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
  "პორტფელის ასისტენტი\n\n/position XLM — რაოდენობა\n/plan STRK — გაყიდვის გეგმა\n/sales XLM — გაყიდვების შედეგი\n/portfolio — ანგარიში\n/alerts — აქტიური ალერტები\n/history — მიღწეული ალერტები\n/next — უახლოესი სამიზნეები\n/transactions — ბოლო ჩანაწერები\n/choose — პორტფელის არჩევა\n\nასევე: „რამდენი XLM მაქვს?“ ან „მაჩვენე STRK-ის გაყიდვის გეგმა“.\nმხოლოდ Telegram-ში არჩეული ხელით სამართავი პორტფელები. მონაცემები არ იცვლება.";

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
  if (!(await accountIsActive(db, connection.userId))) return;
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
  const response =
    command && command.kind !== "help"
      ? await assistantReport(
          db,
          connection.userId,
          connection.portfolioIds,
          command,
          {
            buyEnabled: connection.buyEnabled,
            sellEnabled: connection.sellEnabled,
          },
        )
      : {
          body: help,
          keyboard: [
            ["/portfolio", "/choose"],
            ["/alerts", "/next"],
            ["/history"],
            ["/transactions", "/help"],
          ],
        };
  const [current] = await db
    .select()
    .from(telegramConnections)
    .where(eq(telegramConnections.userId, connection.userId));
  if (
    !(await accountIsActive(db, connection.userId)) ||
    !current ||
    current.chatId !== connection.chatId ||
    current.generation !== connection.generation ||
    [...current.portfolioIds].sort().join() !==
      [...connection.portfolioIds].sort().join()
  )
    return;
  await sendTelegram(
    connection.chatId!,
    response.body,
    undefined,
    undefined,
    "links" in response
      ? { links: response.links }
      : { keyboard: response.keyboard },
  );
}
