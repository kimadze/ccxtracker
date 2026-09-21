import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { ZodError } from "zod";
import { requireUser } from "./auth";
import { getDb } from "./db";
import { assets, userSettings } from "./db/schema";
import { eq } from "drizzle-orm";
import { portfolioService, AccessError } from "./services/portfolio";
import { getQuotes } from "./market";
import { replayLedger } from "@/domain/ledger";
import { valuePortfolio } from "@/domain/valuation";

export const loadWorkspace = cache(async (id: string) => {
  const user = await requireUser();
  const service = portfolioService(getDb(), user.id);
  const portfolio = await service.owned(id).catch((error) => {
    if (error instanceof AccessError || error instanceof ZodError) notFound();
    throw error;
  });
  const [entries, allAssets, settings] = await Promise.all([
    service.entries(id),
    getDb().select().from(assets),
    getDb().select().from(userSettings).where(eq(userSettings.userId, user.id)).limit(1),
  ]);
  const ledger = replayLedger(entries);
  const quotes = await getQuotes(
    allAssets.filter((a) =>
      ledger.holdings.some((h) => h.assetId === a.id && h.quantity !== "0"),
    ),
  );
  return {
    portfolio,
    entries,
    assets: allAssets,
    summary: valuePortfolio(ledger, allAssets, quotes),
    settings: {
      cryptoOnlyPortfolioValue: settings[0]?.cryptoOnlyPortfolioValue ?? false,
    },
  };
});
