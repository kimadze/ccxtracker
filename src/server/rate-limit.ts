import "server-only";
import { and, asc, inArray, lt, sql } from "drizzle-orm";
import { getDb, type Database } from "./db";
import { rateLimits } from "./db/schema";
export async function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  db: Database = getDb(),
) {
  const now = Date.now(),
    cutoff = now - windowMs;
  const [row] = await db
    .insert(rateLimits)
    .values({ id: crypto.randomUUID(), key, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`CASE WHEN ${rateLimits.lastRequest} < ${cutoff} THEN 1 ELSE LEAST(${rateLimits.count} + 1, ${limit + 1}) END`,
        lastRequest: sql`CASE WHEN ${rateLimits.lastRequest} < ${cutoff} THEN ${now} ELSE ${rateLimits.lastRequest} END`,
      },
    })
    .returning();
  return row.count <= limit;
}

/** Seven days exceeds every current rate/dedup window (the longest is one day). */
export async function cleanupRateLimits(db: Database = getDb(), limit = 500) {
  const cutoff = Date.now() - 7 * 86400000;
  const old = db
    .select({ id: rateLimits.id })
    .from(rateLimits)
    .where(lt(rateLimits.lastRequest, cutoff))
    .orderBy(asc(rateLimits.lastRequest))
    .limit(Math.max(1, Math.min(1000, limit)));
  const removed = await db
    .delete(rateLimits)
    .where(and(lt(rateLimits.lastRequest, cutoff), inArray(rateLimits.id, old)))
    .returning({ id: rateLimits.id });
  return removed.length;
}
