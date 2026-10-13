import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { adminControls } from "@/server/db/schema";

export async function aiPolicy() {
  const [row] = await getDb()
    .select()
    .from(adminControls)
    .where(eq(adminControls.key, "global"));
  return row ?? { aiEnabled: true, userDailyLimit: 20, globalDailyLimit: 300 };
}
