import { secretMatches, telegramConfigured } from "@/server/telegram/api";
import { registerTelegramWebhook } from "@/server/telegram/setup";
import { consumeRateLimit } from "@/server/rate-limit";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  if (!process.env.CRON_SECRET || process.env.CRON_SECRET.length < 32)
    return new Response(null, { status: 503 });
  if (
    !secretMatches(
      request.headers.get("authorization"),
      `Bearer ${process.env.CRON_SECRET}`,
    )
  )
    return new Response(null, { status: 401 });
  if (!telegramConfigured())
    return Response.json({ error: "TELEGRAM_NOT_CONFIGURED" }, { status: 503 });
  try {
    if (!(await consumeRateLimit("telegram-operator-setup", 3, 60000)))
      return new Response(null, { status: 429 });
    return Response.json(await registerTelegramWebhook());
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "TELEGRAM_BOT_MISMATCH" || code === "TELEGRAM_WEBHOOK_IN_USE")
      return Response.json({ error: code }, { status: 409 });
    return Response.json({ error: "TELEGRAM_SETUP_FAILED" }, { status: 502 });
  }
}
