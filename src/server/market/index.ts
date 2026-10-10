import "server-only";
import { inArray, and, eq, lt } from "drizzle-orm";
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
  try {
    await db
      .insert(jobState)
      .values({ key: "market-refresh", leaseUntil: new Date(0) })
      .onConflictDoNothing();
    const now = new Date();
    const [lease] = await db
      .update(jobState)
      .set({ leaseUntil: new Date(now.getTime() + 60000), updatedAt: now })
      .where(
        and(eq(jobState.key, "market-refresh"), lt(jobState.leaseUntil, now)),
      )
      .returning();
    if (!lease) return [];
    leased = true;

    const provider = new CoinGeckoProvider();
    const fresh: Quote[] = [];
    for (let i = 0; i < Math.min(expired.length, 200); i += 100)
      fresh.push(...(await provider.quotes(expired.slice(i, i + 100))));
    for (const quote of fresh)
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
          .where(eq(jobState.key, "market-refresh"));
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
  options: { mode?: "background" | "blocking" } = {},
): Promise<Quote[]> {
  const requested = assets.filter((a) => a.id !== "USD");
  if (!requested.length) return [];
  const db = getDb();
  const cached = await db
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
  const fresh =
    expired.length && options.mode === "blocking"
      ? await refreshExpired(expired)
      : [];
  if (
    expired.length &&
    options.mode !== "blocking" &&
    process.env.COINGECKO_DEMO_API_KEY
  )
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
    ...fresh,
    ...cached
      .filter((q) => !fresh.some((f) => f.assetId === q.assetId))
      .map((q) => ({
        assetId: q.assetId,
        price: q.price,
        change24h: q.change24h,
        updatedAt: q.quotedAt.toISOString(),
        stale: Date.now() - q.quotedAt.getTime() > 15 * 60000,
      })),
  ];
}
