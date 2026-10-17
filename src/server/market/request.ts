import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { jobState } from "@/server/db/schema";
import { consumeRateLimit } from "@/server/rate-limit";

/** Shared admission across instances and across search, statistics and quotes. */
export async function coinGeckoRequest(path: string): Promise<unknown> {
  const key = process.env.COINGECKO_DEMO_API_KEY;
  if (!key) throw new Error("MARKET_NOT_CONFIGURED");
  const db = getDb();
  const [cooldown] = await db
    .select({ key: jobState.key })
    .from(jobState)
    .where(
      and(
        eq(jobState.key, "market-provider-backoff"),
        gt(jobState.leaseUntil, new Date()),
      ),
    );
  if (cooldown) throw new Error("MARKET_RATE_LIMIT");
  const configured = Number(process.env.COINGECKO_REQUESTS_PER_MINUTE ?? 20);
  const limit =
    Number.isInteger(configured) && configured >= 4 && configured <= 120
      ? configured
      : 20;
  // Reserve a quarter of the local budget for portfolio/alert quote refreshes.
  if (
    !path.startsWith("/simple/price?") &&
    !(await consumeRateLimit(
      "coingecko-secondary",
      Math.floor(limit * 0.75),
      60000,
      db,
    ))
  )
    throw new Error("MARKET_RATE_LIMIT");
  if (!(await consumeRateLimit("coingecko-global", limit, 60000, db)))
    throw new Error("MARKET_RATE_LIMIT");
  const response = await fetch(`https://api.coingecko.com/api/v3${path}`, {
    headers: { "x-cg-demo-api-key": key },
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  if (response.status === 429) {
    const retry = response.headers.get("retry-after");
    const seconds =
      retry && /^\d+$/.test(retry)
        ? Number(retry)
        : retry
          ? (Date.parse(retry) - Date.now()) / 1000
          : 60;
    const delay = Number.isFinite(seconds)
      ? Math.min(86400, Math.max(1, seconds))
      : 60;
    const leaseUntil = new Date(Date.now() + delay * 1000);
    await db
      .insert(jobState)
      .values({ key: "market-provider-backoff", leaseUntil })
      .onConflictDoUpdate({
        target: jobState.key,
        set: {
          leaseUntil: sql`GREATEST(${jobState.leaseUntil}, ${leaseUntil.toISOString()}::timestamptz)`,
          updatedAt: new Date(),
        },
      });
  }
  if (!response.ok) throw new Error(`MARKET_REQUEST_FAILED_${response.status}`);
  return response.json();
}
