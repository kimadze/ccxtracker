import "server-only";
import { cache } from "react";
import { requireUser } from "./auth";
import { getDb } from "./db";
import { assets } from "./db/schema";
import { portfolioService } from "./services/portfolio";
import { getQuotes } from "./market";
import { replayLedger } from "@/domain/ledger";
import { valuePortfolio } from "@/domain/valuation";

export const loadWorkspace = cache(async (id: string) => {
  const user = await requireUser();
  const service = portfolioService(getDb(), user.id);
  const portfolio = await service.owned(id);
  const [entries, allAssets] = await Promise.all([service.entries(id), getDb().select().from(assets)]);
  const ledger = replayLedger(entries);
  const quotes = await getQuotes(allAssets.filter(a => ledger.holdings.some(h => h.assetId === a.id && h.quantity !== "0")));
  return { portfolio, entries, assets: allAssets, summary: valuePortfolio(ledger, allAssets, quotes) };
});
