"use server";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { telegramService } from "./service";
import { consumeRateLimit } from "@/server/rate-limit";
import { userError } from "@/server/errors";
import { idSchema } from "@/domain/validation";
export async function loadTelegramSettings() {
  const user = await requireUser();
  try {
    return {
      ok: true as const,
      ...(await telegramService(getDb(), user.id).status()),
    };
  } catch (error) {
    return { ok: false as const, error: userError(error) };
  }
}
export async function beginTelegramLink(portfolioId: string) {
  const user = await requireUser();
  try {
    idSchema.parse(portfolioId);
    if (!(await consumeRateLimit(`telegram-link:${user.id}`, 5, 600000)))
      throw new Error("TELEGRAM_RATE_LIMIT");
    return {
      ok: true as const,
      ...(await telegramService(getDb(), user.id).begin(portfolioId)),
    };
  } catch (error) {
    return { ok: false as const, error: userError(error) };
  }
}
export async function confirmTelegramLink() {
  const user = await requireUser();
  try {
    await telegramService(getDb(), user.id).confirm();
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: userError(error) };
  }
}
export async function saveTelegramPreferences(input: unknown) {
  const user = await requireUser();
  try {
    await telegramService(getDb(), user.id).preferences(input);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: userError(error) };
  }
}
export async function disconnectTelegram() {
  const user = await requireUser();
  try {
    await telegramService(getDb(), user.id).disconnect();
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: userError(error) };
  }
}
export async function testTelegramConnection() {
  const user = await requireUser();
  try {
    if (!(await consumeRateLimit(`telegram-test:${user.id}`, 3, 60000)))
      throw new Error("TELEGRAM_RATE_LIMIT");
    await telegramService(getDb(), user.id).test();
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: userError(error) };
  }
}
