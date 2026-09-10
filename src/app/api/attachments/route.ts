import { and, eq } from "drizzle-orm";
import { put, del } from "@vercel/blob";
import { getCurrentUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { journalAttachments, journals } from "@/server/db/schema";
import { portfolioService } from "@/server/services/portfolio";
import { idSchema } from "@/domain/validation";
const MAX_FILE = 2 * 1024 * 1024;
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "საჭიროა ანგარიშში შესვლა." }, { status: 401 });
  if (!process.env.BETTER_AUTH_URL || request.headers.get("origin") !== new URL(process.env.BETTER_AUTH_URL).origin) return Response.json({ error: "წვდომა აკრძალულია." }, { status: 403 });
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) return Response.json({ error: "დანართების შენახვა დროებით მიუწვდომელია." }, { status: 503 });
  let uploaded: string | undefined;
  try {
    const reader = request.body?.getReader(); if (!reader) throw new Error("INVALID_FILE");
    const chunks: Buffer[] = []; let size = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > MAX_FILE + 65536) { await reader.cancel(); return Response.json({ error: "ფაილის მაქსიმალური ზომაა 2 მბ." }, { status: 413 }); } chunks.push(Buffer.from(value)); }
    const form = await new Request(request.url, { method: "POST", headers: request.headers, body: Buffer.concat(chunks) }).formData();
    const portfolioId = idSchema.parse(form.get("portfolioId")), journalId = idSchema.parse(form.get("journalId"));
    const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > MAX_FILE || !["application/pdf", "image/png", "image/jpeg"].includes(file.type)) throw new Error("INVALID_FILE");
    const buffer = Buffer.from(await file.arrayBuffer());
    const valid = file.type === "application/pdf" ? buffer.subarray(0, 5).toString() === "%PDF-" : file.type === "image/png" ? buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
    if (!valid) throw new Error("INVALID_FILE");
    const db = getDb(); await portfolioService(db, user.id).owned(portfolioId);
    await db.transaction(async tx => {
      const [journal] = await tx.select().from(journals).where(and(eq(journals.id, journalId), eq(journals.portfolioId, portfolioId))).for("update");
      if (!journal) throw new Error("NOT_FOUND");
      const files = await tx.select().from(journalAttachments).where(eq(journalAttachments.journalId, journalId));
      if (files.length >= 5) throw new Error("FILE_LIMIT");
      const blob = await put(`journals/${portfolioId}/${crypto.randomUUID()}`, buffer, { access: "private", contentType: file.type, addRandomSuffix: true }); uploaded = blob.pathname;
      await tx.insert(journalAttachments).values({ portfolioId, journalId, name: file.name.replace(/[\r\n\x00-\x1f]/g, "").slice(0, 180) || "დანართი", blobPath: blob.pathname, contentType: file.type, size: file.size });
    });
    return Response.json({ ok: true });
  } catch { if (uploaded) await del(uploaded).catch(() => console.error("Attachment cleanup required")); return Response.json({ error: "ფაილი ვერ შეინახა. დასაშვებია PDF, PNG ან JPEG, მაქსიმუმ 2 მბ; თითო ჩანაწერზე — 5 ფაილი." }, { status: 400 }); }
}
