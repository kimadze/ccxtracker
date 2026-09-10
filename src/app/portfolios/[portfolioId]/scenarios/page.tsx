import { loadWorkspace } from "@/server/workspace";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { scenarioService } from "@/server/services/scenarios";
import { PageHeading } from "@/components/shell";
import { ScenarioLab } from "@/components/scenario-lab";
export default async function Page({
  params,
}: {
  params: Promise<{ portfolioId: string }>;
}) {
  const { portfolioId } = await params;
  const w = await loadWorkspace(portfolioId);
  const user = await requireUser();
  const data = await scenarioService(getDb(), user.id).list(portfolioId);
  return (
    <>
      <PageHeading
        eyebrow={w.portfolio.name}
        title="სცენარების ლაბორატორია"
        description="გამოცადეთ თქვენი ხედვა მიმდინარე პორტფელზე."
      />
      <ScenarioLab
        summary={w.summary}
        portfolioId={portfolioId}
        saved={data.scenarios}
        goal={data.goal}
      />
    </>
  );
}
