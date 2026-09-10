import "server-only";
import { inArray } from "drizzle-orm";
import { getDb } from "@/server/db";
import { assets as assetTable, marketQuotes } from "@/server/db/schema";
import type { Asset, Quote } from "@/domain/types";
import { CoinGeckoProvider } from "./provider";

export const coreAssets: Asset[] = [
  { id: "USD", providerId: "usd-cash", symbol: "USD", name: "აშშ დოლარი", isStablecoin: false },
  { id: "bitcoin", providerId: "bitcoin", symbol: "BTC", name: "Bitcoin", isStablecoin: false },
  { id: "ethereum", providerId: "ethereum", symbol: "ETH", name: "Ethereum", isStablecoin: false },
  { id: "solana", providerId: "solana", symbol: "SOL", name: "Solana", isStablecoin: false },
  { id: "tether", providerId: "tether", symbol: "USDT", name: "Tether", isStablecoin: true },
  { id: "usd-coin", providerId: "usd-coin", symbol: "USDC", name: "USDC", isStablecoin: true },
];
export async function seedAssets() { await getDb().insert(assetTable).values(coreAssets).onConflictDoNothing(); }

export async function getQuotes(assets: Asset[]): Promise<Quote[]> {
  const requested = assets.filter(a => a.id !== "USD");
  if (!requested.length) return [];
  const db = getDb();
  const cached = await db.select().from(marketQuotes).where(inArray(marketQuotes.assetId, requested.map(a => a.id)));
  const expired = requested.filter(a => { const hit = cached.find(q => q.assetId === a.id); return !hit || Date.now() - hit.fetchedAt.getTime() > 5 * 60000; });
  const fresh: Quote[] = [];
  if (expired.length && process.env.COINGECKO_DEMO_API_KEY) {
    try {
      const provider = new CoinGeckoProvider();
      for (let i = 0; i < expired.length; i += 100) fresh.push(...await provider.quotes(expired.slice(i, i + 100)));
      for (const q of fresh) await db.insert(marketQuotes).values({ assetId: q.assetId, price: q.price, change24h: q.change24h, quotedAt: new Date(q.updatedAt) }).onConflictDoUpdate({ target: marketQuotes.assetId, set: { price: q.price, change24h: q.change24h, quotedAt: new Date(q.updatedAt), fetchedAt: new Date() } });
    } catch { console.warn("Market quote refresh failed; serving available cached quotes"); }
  }
  return [...fresh, ...cached.filter(q => !fresh.some(f => f.assetId === q.assetId)).map(q => ({ assetId: q.assetId, price: q.price, change24h: q.change24h, updatedAt: q.quotedAt.toISOString(), stale: Date.now() - q.quotedAt.getTime() > 15 * 60000 }))];
}
