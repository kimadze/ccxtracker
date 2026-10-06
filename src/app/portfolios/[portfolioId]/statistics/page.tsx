import { PageHeading } from "@/components/shell";
import { StatisticsWorkspace } from "@/components/statistics-workspace";
import { loadWorkspace } from "@/server/workspace";
import {
  getMarketStatistics,
  getAssetMarketStatistics,
} from "@/server/market/statistics";
import { getMacroStatistics } from "@/server/macro/provider";
import { getDb } from "@/server/db";
import { snapshots } from "@/server/db/schema";
import { asc, eq } from "drizzle-orm";
import { analyzePerformance } from "@/domain/analytics";
import { calculatePortfolioAttribution } from "@/domain/attribution";
import { replayLedger } from "@/domain/ledger";

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
    : "portfolio";
  const [workspace, market, macro] = await Promise.all([
    loadWorkspace(portfolioId),
    tab === "market" ? getMarketStatistics() : Promise.resolve(null),
    tab === "macro" ? getMacroStatistics() : Promise.resolve(null),
  ]);
  const ownedAssets =
    tab === "portfolio"
      ? await getAssetMarketStatistics(
          workspace.summary.positions
            .filter((position) => position.quantity !== "0")
            .map((position) => position.asset.providerId),
        )
      : [];
  const history =
    tab === "portfolio"
      ? await getDb()
          .select()
          .from(snapshots)
          .where(eq(snapshots.portfolioId, portfolioId))
          .orderBy(asc(snapshots.capturedAt))
      : [];
  const analysis =
    tab === "portfolio"
      ? {
          attribution: calculatePortfolioAttribution(
            replayLedger(workspace.entries),
            workspace.summary,
            workspace.assets,
          ),
          performance: (() => {
            const { valid, returnPercent, maxDrawdown } = analyzePerformance(
              history.map((s) => ({
                ...s,
                capturedAt: s.capturedAt.toISOString(),
              })),
              workspace.entries,
            );
            return { valid, returnPercent, maxDrawdown };
          })(),
          from: history[0]?.capturedAt.toISOString() ?? null,
          to: history.at(-1)?.capturedAt.toISOString() ?? null,
        }
      : null;
  return (
    <>
      <PageHeading
        eyebrow={workspace.portfolio.name}
        title="სტატისტიკა"
        description={null}
      />
      <StatisticsWorkspace
        market={market}
        macro={macro}
        summary={workspace.summary}
        portfolioId={portfolioId}
        ownedAssets={ownedAssets}
        analysis={analysis}
      />
    </>
  );
}
