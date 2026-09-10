import { getAuth } from "@/server/auth";
import { isConfigured } from "@/server/config";

async function handler(request: Request) {
  if (!isConfigured()) return Response.json({ message: "შესვლა დროებით მიუწვდომელია." }, { status: 503 });
  try { return await getAuth().handler(request); }
  catch { console.error("Authentication request failed"); return Response.json({ message: "შესვლა ვერ მოხერხდა. სცადეთ ხელახლა." }, { status: 500 }); }
}
export const GET = handler;
export const POST = handler;
