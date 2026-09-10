import { and, eq } from "drizzle-orm";
import { get, del } from "@vercel/blob";
import { getCurrentUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { journalAttachments, portfolios } from "@/server/db/schema";
import { idSchema } from "@/domain/validation";
async function ownedFile(id: string, userId: string) {
  idSchema.parse(id);
  const [file] = await getDb().select({ file: journalAttachments }).from(journalAttachments).innerJoin(portfolios, eq(portfolios.id, journalAttachments.portfolioId)).where(and(eq(journalAttachments.id, id), eq(portfolios.userId, userId)));
  return file?.file;
}
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(); if (!user) return new Response("საჭიროა ანგარიშში შესვლა.", { status: 401 });
  try {
    const file = await ownedFile((await params).id, user.id); if (!file) return new Response("ფაილი ვერ მოიძებნა.", { status: 404 });
    const blob = await get(file.blobPath, { access: "private" }); if (!blob || blob.statusCode !== 200) return new Response("ფაილი ვერ მოიძებნა.", { status: 404 });
    return new Response(blob.stream, { headers: { "Content-Type": file.contentType, "Content-Disposition": `attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(file.name)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response("ფაილის ჩატვირთვა ვერ მოხერხდა.", { status: 500 }); }
}
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(); if (!user) return Response.json({ error: "საჭიროა ანგარიშში შესვლა." }, { status: 401 });
  if (!process.env.BETTER_AUTH_URL || request.headers.get("origin") !== new URL(process.env.BETTER_AUTH_URL).origin) return Response.json({ error: "წვდომა აკრძალულია." }, { status: 403 });
  try { const file = await ownedFile((await params).id, user.id); if (!file) return Response.json({ error: "ფაილი ვერ მოიძებნა." }, { status: 404 }); await del(file.blobPath); await getDb().delete(journalAttachments).where(eq(journalAttachments.id, file.id)); return Response.json({ ok: true }); }
  catch { return Response.json({ error: "წაშლა ვერ მოხერხდა." }, { status: 500 }); }
}
