import { loadWorkspace } from "@/server/workspace";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { strategyService } from "@/server/services/strategy";
import { scenarioService } from "@/server/services/scenarios";
import { allocationService } from "@/server/services/allocation";
import { getQuotes } from "@/server/market";
import { PageHeading } from "@/components/shell";
import { PlanningTabs } from "@/components/planning-tabs";
import { StrategyWorkspace } from "@/components/strategy-workspace";
import { ScenarioLab } from "@/components/scenario-lab";
import { AllocationWorkspace } from "@/components/allocation-workspace";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ portfolioId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { portfolioId } = await params;
  const query = await searchParams;
  const tab =
    query.tab === "scenarios" || query.tab === "allocation"
      ? query.tab
      : "strategy";
  const w = await loadWorkspace(portfolioId),
    user = await requireUser(),
    db = getDb();
  let content;
  if (tab === "strategy") {
    const data = Object.fromEntries(
      await Promise.all(
        w.summary.positions.map(async (p) => [
          p.assetId,
          await strategyService(db, user.id).load(portfolioId, p.assetId),
        ]),
      ),
    );
    content = (
      <StrategyWorkspace
        summary={w.summary}
        portfolioId={portfolioId}
        data={data}
      />
    );
  } else if (tab === "scenarios") {
    const data = await scenarioService(db, user.id).list(portfolioId);
    content = (
      <ScenarioLab
        summary={w.summary}
        portfolioId={portfolioId}
        saved={data.scenarios}
        goal={data.goal}
      />
    );
  } else {
    const initial = await allocationService(db, user.id).list(portfolioId);
    const quotes = await getQuotes(
      w.assets.filter(
        (a) =>
          initial.some((r) => r.assetId === a.id) ||
          w.summary.positions.some((p) => p.assetId === a.id),
      ),
    );
    content = (
      <AllocationWorkspace
        summary={w.summary}
        portfolioId={portfolioId}
        assets={w.assets}
        quotes={quotes}
        revision={w.portfolio.revision}
        initial={initial}
      />
    );
  }
  return (
    <>
      <PageHeading title="დაგეგმვა" eyebrow="" description="" />
      <PlanningTabs tab={tab}>{content}</PlanningTabs>
    </>
  );
}
