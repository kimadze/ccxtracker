import { getDb } from "@/server/db";
import { secretMatches, telegramConfigured } from "@/server/telegram/api";
import { acceptTelegramLink } from "@/server/telegram/service";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!telegramConfigured()) return new Response(null, { status: 503 });
  if (
    !secretMatches(
      request.headers.get("x-telegram-bot-api-secret-token"),
      process.env.TELEGRAM_WEBHOOK_SECRET,
    )
  )
    return new Response(null, { status: 401 });
  if (Number(request.headers.get("content-length")) > 16384)
    return new Response(null, { status: 413 });
  try {
    const text = await request.text();
    if (text.length > 16384) return new Response(null, { status: 413 });
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      return new Response(null, { status: 400 });
    }
    await acceptTelegramLink(getDb(), payload);
    return Response.json({ ok: true });
  } catch {
    console.error("TELEGRAM_WEBHOOK_FAILED");
    return new Response(null, { status: 500 });
  }
}
