import "server-only";
import { inArray, and, eq, lt, like, asc } from "drizzle-orm";
import { after } from "next/server";
import { getDb } from "@/server/db";
import {
  assets as assetTable,
  marketQuotes,
  jobState,
} from "@/server/db/schema";
import type { Asset, Quote } from "@/domain/types";
import { CoinGeckoProvider } from "./provider";
import { evaluateWatchlistTargets } from "../services/watchlist-notifications";
import { processTelegramDeliveries } from "../telegram/delivery";
import {
  evaluateTakeProfits,
  processTakeProfitDeliveries,
} from "../telegram/take-profit";

export const coreAssets: Asset[] = [
  {
    id: "USD",
    providerId: "usd-cash",
    symbol: "USD",
    name: "აშშ დოლარი",
    isStablecoin: false,
    category: "cash",
  },
  {
    id: "bitcoin",
    providerId: "bitcoin",
    symbol: "BTC",
    name: "Bitcoin",
    isStablecoin: false,
    category: "store-of-value",
    logoUrl:
      "https://assets.coingecko.com/coins/images/1/large/bitcoin.png?1696501400",
  },
  {
    id: "ethereum",
    providerId: "ethereum",
    symbol: "ETH",
    name: "Ethereum",
    isStablecoin: false,
    category: "layer-1",
    logoUrl:
      "https://assets.coingecko.com/coins/images/279/large/ethereum.png?1696501628",
  },
  {
    id: "solana",
    providerId: "solana",
    symbol: "SOL",
    name: "Solana",
    isStablecoin: false,
    category: "layer-1",
    logoUrl:
      "https://assets.coingecko.com/coins/images/4128/large/solana.png?1696504756",
  },
  {
    id: "tether",
    providerId: "tether",
    symbol: "USDT",
    name: "Tether",
    isStablecoin: true,
    category: "stablecoin",
    logoUrl:
      "https://assets.coingecko.com/coins/images/325/large/Tether.png?1696501661",
  },
  {
    id: "usd-coin",
    providerId: "usd-coin",
    symbol: "USDC",
    name: "USDC",
    isStablecoin: true,
    category: "stablecoin",
    logoUrl:
      "https://assets.coingecko.com/coins/images/6319/large/usdc.png?1696506694",
  },
];
export async function seedAssets() {
  for (const asset of coreAssets)
    await getDb()
      .insert(assetTable)
      .values(asset)
      .onConflictDoUpdate({
        target: assetTable.id,
        set: { logoUrl: asset.logoUrl, updatedAt: new Date() },
      });
}

async function refreshExpired(expired: Asset[]): Promise<Quote[]> {
  if (!expired.length || !process.env.COINGECKO_DEMO_API_KEY) return [];
  const db = getDb();
  let leased = false;
  const leaseUntil = new Date(Date.now() + 60000);
  try {
    // Persist requests before claiming the shared provider slot. A competing
    // worker can drain them; provider failures leave them available for retry.
    await db
      .insert(jobState)
      .values(
        expired.map((asset) => ({
          key: `market-pending:${asset.id}`,
          cursor: JSON.stringify(asset),
          leaseUntil: new Date(0),
        })),
      )
      .onConflictDoNothing();
    await db
      .insert(jobState)
      .values({ key: "market-refresh", leaseUntil: new Date(0) })
      .onConflictDoNothing();
    const now = new Date();
    const [lease] = await db
      .update(jobState)
      .set({ leaseUntil, updatedAt: now })
      .where(
        and(eq(jobState.key, "market-refresh"), lt(jobState.leaseUntil, now)),
      )
      .returning();
    if (!lease) return [];
    leased = true;

    const provider = new CoinGeckoProvider();
    const fresh: Quote[] = [];
    for (let i = 0; i < 2; i++) {
      const pending = await db
        .select()
        .from(jobState)
        .where(like(jobState.key, "market-pending:%"))
        .orderBy(asc(jobState.updatedAt))
        .limit(100);
      if (!pending.length) break;
      const batch = pending.map((row) => JSON.parse(row.cursor!) as Asset);
      const cached = await db
        .select()
        .from(marketQuotes)
        .where(
          inArray(
            marketQuotes.assetId,
            batch.map((a) => a.id),
          ),
        );
      const needed = batch.filter(
        (a) =>
          !cached.some(
            (q) =>
              q.assetId === a.id &&
              Date.now() - q.fetchedAt.getTime() <= 5 * 60000,
          ),
      );
      const received = needed.length ? await provider.quotes(needed) : [];
      fresh.push(...received);
      // An empty provider response is a completed attempt, not a fabricated price.
      // Save before acknowledging so a crash cannot lose fetched quotes.
      for (const quote of received)
        await db
          .insert(marketQuotes)
          .values({
            assetId: quote.assetId,
            price: quote.price,
            change24h: quote.change24h,
            quotedAt: new Date(quote.updatedAt),
          })
          .onConflictDoUpdate({
            target: marketQuotes.assetId,
            set: {
              price: quote.price,
              change24h: quote.change24h,
              quotedAt: new Date(quote.updatedAt),
              fetchedAt: new Date(),
            },
          });
      await db.delete(jobState).where(
        inArray(
          jobState.key,
          pending.map((r) => r.key),
        ),
      );
    }
    try {
      await evaluateWatchlistTargets(db, fresh);
      await evaluateTakeProfits(db, fresh);
    } catch {
      console.warn("Watchlist target evaluation failed", { retryable: true });
    }
    return fresh;
  } catch (error) {
    console.warn("Market quote refresh failed", {
      retryable: true,
      reason: error instanceof Error ? error.message : "UNKNOWN",
    });
    return [];
  } finally {
    if (leased) {
      try {
        await db
          .update(jobState)
          .set({ leaseUntil: new Date(0), updatedAt: new Date() })
          .where(
            and(
              eq(jobState.key, "market-refresh"),
              eq(jobState.leaseUntil, leaseUntil),
            ),
          );
      } catch {
        console.error("Market refresh lease release failed", {
          retryable: true,
        });
      }
    }
  }
}

export async function getQuotes(
  assets: Asset[],
  options: { mode?: "background" | "blocking" } = { mode: "blocking" },
): Promise<Quote[]> {
  const requested = assets.filter((a) => a.id !== "USD");
  if (!requested.length) return [];
  const db = getDb();
  let cached = await db
    .select()
    .from(marketQuotes)
    .where(
      inArray(
        marketQuotes.assetId,
        requested.map((a) => a.id),
      ),
    );
  const expired = requested.filter((a) => {
    const hit = cached.find((q) => q.assetId === a.id);
    return !hit || Date.now() - hit.fetchedAt.getTime() > 5 * 60000;
  });
  const blocking = options.mode !== "background";
  if (expired.length && blocking) {
    await refreshExpired(expired);
    cached = await db
      .select()
      .from(marketQuotes)
      .where(
        inArray(
          marketQuotes.assetId,
          requested.map((a) => a.id),
        ),
      );
  }
  if (expired.length && !blocking && process.env.COINGECKO_DEMO_API_KEY)
    after(async () => {
      await refreshExpired(expired);
      try {
        await processTelegramDeliveries(db);
        await processTakeProfitDeliveries(db);
      } catch {
        console.warn("TELEGRAM_QUEUE_RETRY_PENDING");
      }
    });
  return [
    ...cached.map((q) => ({
      assetId: q.assetId,
      price: q.price,
      change24h: q.change24h,
      updatedAt: q.quotedAt.toISOString(),
      stale: Date.now() - q.quotedAt.getTime() > 15 * 60000,
    })),
  ];
}
