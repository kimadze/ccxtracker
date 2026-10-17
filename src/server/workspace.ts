import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { ZodError } from "zod";
import { requireUser } from "./auth";
import { getDb } from "./db";
import { assets, userSettings } from "./db/schema";
import { eq, inArray } from "drizzle-orm";
import { portfolioService, AccessError } from "./services/portfolio";
import { getQuotes } from "./market";
import { replayLedger } from "@/domain/ledger";
import { valuePortfolio } from "@/domain/valuation";
import { classifyAsset } from "@/domain/asset-classification";

const loadPortfolio = cache(async (id: string, fullCatalog: boolean) => {
  const user = await requireUser();
  const service = portfolioService(getDb(), user.id);
  const portfolio = await service.owned(id).catch((error) => {
    if (error instanceof AccessError || error instanceof ZodError) notFound();
    throw error;
  });
  const [entries, settings] = await Promise.all([
    service.entries(id),
    getDb()
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, user.id))
      .limit(1),
  ]);
  const ledger = replayLedger(entries);
  const ids = [...new Set(["USD", ...ledger.holdings.map((h) => h.assetId)])];
  const allAssets = await getDb()
    .select()
    .from(assets)
    .where(fullCatalog ? undefined : inArray(assets.id, ids));
  const held = new Set(
    ledger.holdings.filter((h) => h.quantity !== "0").map((h) => h.assetId),
  );
  const quotes = await getQuotes(allAssets.filter((a) => held.has(a.id)));
  return {
    portfolio,
    entries,
    assets: allAssets.map(classifyAsset),
    summary: valuePortfolio(ledger, allAssets, quotes),
    settings: {
      cryptoOnlyPortfolioValue: settings[0]?.cryptoOnlyPortfolioValue ?? false,
    },
  };
});
export const loadWorkspace = cache((id: string, fullCatalog = true) =>
  loadPortfolio(id, fullCatalog),
);
export const loadPortfolioCard = cache((id: string) =>
  loadPortfolio(id, false),
);
