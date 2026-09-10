import { timingSafeEqual } from "node:crypto";
import { runSnapshots } from "@/server/snapshots";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || expected.length < 32) return Response.json({ error: "სერვისი მიუწვდომელია." }, { status: 503 });
  const actual = request.headers.get("authorization") ?? "";
  const token = `Bearer ${expected}`;
  if (Buffer.byteLength(actual) !== Buffer.byteLength(token) || !timingSafeEqual(Buffer.from(actual), Buffer.from(token))) return Response.json({ error: "წვდომა აკრძალულია." }, { status: 401 });
  try { return Response.json(await runSnapshots()); }
  catch { console.error("Snapshot job failed"); return Response.json({ error: "მონაცემების შენახვა ვერ მოხერხდა." }, { status: 500 }); }
}
