import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { rateLimits } from "./db/schema";
export async function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
) {
  const now = Date.now(),
    cutoff = now - windowMs;
  const [row] = await getDb()
    .insert(rateLimits)
    .values({ id: crypto.randomUUID(), key, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`CASE WHEN ${rateLimits.lastRequest} < ${cutoff} THEN 1 ELSE ${rateLimits.count} + 1 END`,
        lastRequest: sql`CASE WHEN ${rateLimits.lastRequest} < ${cutoff} THEN ${now} ELSE ${rateLimits.lastRequest} END`,
      },
    })
    .returning();
  return row.count <= limit;
}
