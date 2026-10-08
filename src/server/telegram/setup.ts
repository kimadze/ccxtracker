import "server-only";
import { appOrigin, telegramCall } from "./api";

/** Operator-only setup. Credentials stay inside the hosting environment. */
export async function registerTelegramWebhook() {
  const bot = await telegramCall("getMe", {});
  if (
    bot.is_bot !== true ||
    typeof bot.username !== "string" ||
    bot.username.toLowerCase() !==
      process.env.TELEGRAM_BOT_USERNAME?.toLowerCase()
  )
    throw new Error("TELEGRAM_BOT_MISMATCH");
  const url = `${appOrigin()}/api/telegram/webhook`;
  const current = await telegramCall("getWebhookInfo", {});
  if (current.url && current.url !== url)
    throw new Error("TELEGRAM_WEBHOOK_IN_USE");
  await telegramCall("setWebhook", {
    url,
    secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ["message"],
    max_connections: 5,
  });
  const verified = await telegramCall("getWebhookInfo", {});
  if (verified.url !== url) throw new Error("TELEGRAM_WEBHOOK_VERIFY_FAILED");
  return { username: bot.username, registered: true as const };
}
