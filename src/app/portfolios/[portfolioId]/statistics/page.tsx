import { PageHeading } from "@/components/shell";
import { StatisticsWorkspace } from "@/components/statistics-workspace";
import { loadWorkspace } from "@/server/workspace";
import { getMarketStatistics } from "@/server/market/statistics";
import { getMacroStatistics } from "@/server/macro/provider";

export default async function Page({
  params,
}: {
  params: Promise<{ portfolioId: string }>;
}) {
  const { portfolioId } = await params;
  const [workspace, market, macro] = await Promise.all([
    loadWorkspace(portfolioId),
    getMarketStatistics(),
    getMacroStatistics(),
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
