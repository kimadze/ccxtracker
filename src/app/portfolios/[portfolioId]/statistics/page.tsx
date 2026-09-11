import { PageHeading } from "@/components/shell";
import { StatisticsWorkspace } from "@/components/statistics-workspace";
import { loadWorkspace } from "@/server/workspace";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { watchlistService } from "@/server/services/watchlist";
import { getMarketStatistics } from "@/server/market/statistics";
import { getMacroStatistics } from "@/server/macro/provider";

export default async function Page({ params }: { params: Promise<{ portfolioId: string }> }) {
  const { portfolioId } = await params;
  const [workspace, user, market, macro] = await Promise.all([
    loadWorkspace(portfolioId),
    requireUser(),
    getMarketStatistics(),
    getMacroStatistics(),
  ]);
  const selected = await watchlistService(getDb(), user.id).list(portfolioId);
  return <>
    <PageHeading eyebrow={workspace.portfolio.name} title="სტატისტიკა" description="კრიპტო ბაზარი, დინამიური მაკრო მონაცემები და თქვენი პორტფელის კონტექსტი." />
    <StatisticsWorkspace market={market} macro={macro} summary={workspace.summary} selectedAssetIds={selected.map((item) => item.asset.id)} base={`/portfolios/${portfolioId}`} />
  </>;
}
