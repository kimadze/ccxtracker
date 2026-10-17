import { PageHeading } from "@/components/shell";
import { StatisticsWorkspace } from "@/components/statistics-workspace";
import { loadWorkspace } from "@/server/workspace";
import { getMacroStatistics } from "@/server/macro/provider";
import { getDb } from "@/server/db";
import { snapshots } from "@/server/db/schema";
import { asc, eq } from "drizzle-orm";
import { analyzePerformance } from "@/domain/analytics";
import { calculatePortfolioAttribution } from "@/domain/attribution";
import { replayLedger } from "@/domain/ledger";
import { redirect } from "next/navigation";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ portfolioId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { portfolioId } = await params;
  const requestedTab = (await searchParams).tab;
  if (requestedTab === "market") {
    redirect(`/portfolios/${portfolioId}/statistics?tab=portfolio`);
  }
  const tab = ["macro", "portfolio"].includes(requestedTab ?? "")
    ? requestedTab
    : "portfolio";
  const [workspace, macro] = await Promise.all([
    loadWorkspace(portfolioId, false),
    tab === "macro" ? getMacroStatistics() : Promise.resolve(null),
  ]);
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
        macro={macro}
        summary={workspace.summary}
        portfolioId={portfolioId}
        analysis={analysis}
      />
    </>
  );
}
