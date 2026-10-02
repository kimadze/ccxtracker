import { PageHeading } from "@/components/shell";
import { StatisticsWorkspace } from "@/components/statistics-workspace";
import { loadWorkspace } from "@/server/workspace";
import { getMarketStatistics } from "@/server/market/statistics";
import { getMacroStatistics } from "@/server/macro/provider";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ portfolioId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { portfolioId } = await params;
  const requestedTab = (await searchParams).tab;
  const tab = ["market", "macro", "portfolio"].includes(requestedTab ?? "")
    ? requestedTab
    : "market";
  const [workspace, market, macro] = await Promise.all([
    loadWorkspace(portfolioId),
    tab === "market" ? getMarketStatistics() : Promise.resolve(null),
    tab === "macro" ? getMacroStatistics() : Promise.resolve(null),
  ]);
  return (
    <>
      <PageHeading
        eyebrow={workspace.portfolio.name}
        title="სტატისტიკა"
        description="კრიპტო ბაზარი, დინამიური მაკრო მონაცემები და თქვენი პორტფელის კონტექსტი."
      />
      <StatisticsWorkspace
        market={market}
        macro={macro}
        summary={workspace.summary}
      />
    </>
  );
}
