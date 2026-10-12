import { getCurrentUser } from "@/server/auth";
import {
  MAX_SCREENSHOT_BYTES,
  parseScreenshot,
  screenshotAllowed,
} from "@/server/ai/screenshot";

export const runtime = "nodejs";
export const maxDuration = 30;
const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user)
    return reply({ ok: false, error: "გთხოვ, გაიარე ავტორიზაცია." }, 401);
  if (!screenshotAllowed(user))
    return reply(
      { ok: false, error: "ფუნქცია ამ ანგარიშისთვის მიუწვდომელია." },
      403,
    );
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return reply({ ok: false, error: "მოთხოვნა უარყოფილია." }, 403);
  const limit = MAX_SCREENSHOT_BYTES + 16384;
  if (
    !request.headers.get("content-type")?.startsWith("multipart/form-data") ||
    Number(request.headers.get("content-length") ?? 0) > limit
  )
    return reply(
      { ok: false, error: "აირჩიე ერთი სურათი, მაქსიმუმ 5MB." },
      413,
    );
  // Bound the body even when Content-Length is absent or forged.
  const reader = request.body?.getReader();
  if (!reader)
    return reply({ ok: false, error: "სურათი არ არის არჩეული." }, 400);
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > limit) {
        await reader.cancel();
        return reply({ ok: false, error: "სურათი 5MB-ზე დიდია." }, 413);
      }
      chunks.push(chunk.value);
    }
    const form = await new Response(Buffer.concat(chunks), {
      headers: { "Content-Type": request.headers.get("content-type")! },
    }).formData();
    return reply(await parseScreenshot(user, form));
  } catch {
    return reply({ ok: false, error: "სურათის მოთხოვნა ვერ შესრულდა." }, 400);
  }
}
