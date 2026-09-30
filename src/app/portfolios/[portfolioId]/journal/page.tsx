import { loadWorkspace } from "@/server/workspace";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { strategyService } from "@/server/services/strategy";
import { PageHeading } from "@/components/shell";
import { StrategyWorkspace } from "@/components/strategy-workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ portfolioId: string }>;
}) {
  const { portfolioId } = await params;
  const w = await loadWorkspace(portfolioId);
  const user = await requireUser();
  const journalAssets = await strategyService(getDb(), user.id).journalAssets(
    portfolioId,
  );
  const assetIds = [
    ...new Set([
      ...w.summary.positions.map((p) => p.assetId),
      ...journalAssets.map((a) => a.id),
    ]),
  ];
  const data = Object.fromEntries(
    await Promise.all(
      assetIds.map(async (assetId) => {
        const item = await strategyService(getDb(), user.id).load(
          portfolioId,
          assetId,
        );
        return [assetId, item];
      }),
    ),
  );
  return (
    <>
      <PageHeading
        eyebrow={w.portfolio.name}
        title="საინვესტიციო ჟურნალი"
        description="შეინახეთ თქვენი თეზისები და გადაწყვეტილებების საფუძველი."
      />
      <StrategyWorkspace
        summary={w.summary}
        portfolioId={portfolioId}
        data={data}
        mode="journal"
        journalAssets={journalAssets}
      />
    </>
  );
}
