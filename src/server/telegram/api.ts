import "server-only";
import { timingSafeEqual } from "node:crypto";
export function telegramConfigured() {
  return Boolean(
    process.env.TELEGRAM_BOT_TOKEN &&
    /^[A-Za-z0-9_]{5,32}$/.test(process.env.TELEGRAM_BOT_USERNAME ?? "") &&
    /^[A-Za-z0-9_-]{32,256}$/.test(process.env.TELEGRAM_WEBHOOK_SECRET ?? "") &&
    appOrigin(),
  );
}
export function appOrigin() {
  try {
    const url = new URL(
      process.env.TELEGRAM_APP_ORIGIN || process.env.BETTER_AUTH_URL || "",
    );
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}
export function secretMatches(
  actual: string | null,
  expected: string | undefined,
) {
  if (!actual || !expected || expected.length < 32) return false;
  const a = Buffer.from(actual),
    b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export class TelegramError extends Error {
  constructor(
    public code: number,
    public retryAfter = 0,
  ) {
    super("TELEGRAM_DELIVERY_FAILED");
  }
}
export async function telegramCall(
  method: "sendMessage" | "setWebhook" | "getMe" | "getWebhookInfo",
  body: Record<string, unknown>,
) {
  if (!telegramConfigured()) throw new Error("TELEGRAM_NOT_CONFIGURED");
  // Never include this URL, response descriptions or credentials in logs/errors.
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      },
    );
    const result = await response.json();
    if (!response.ok || result.ok !== true)
      throw new TelegramError(
        Number(result.error_code) || response.status,
        Number(result.parameters?.retry_after) || 0,
      );
    return result.result;
  } catch (error) {
    if (error instanceof TelegramError) throw error;
    throw new TelegramError(0);
  }
}
export function sendTelegram(chatId: string, text: string, url?: string) {
  return telegramCall("sendMessage", {
    chat_id: chatId,
    text,
    protect_content: true,
    link_preview_options: { is_disabled: true },
    ...(url
      ? {
          reply_markup: { inline_keyboard: [[{ text: "აქტივის ნახვა", url }]] },
        }
      : {}),
  });
}
