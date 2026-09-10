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
  const data = Object.fromEntries(
    await Promise.all(
      w.summary.positions.map(async (p) => [
        p.assetId,
        await strategyService(getDb(), user.id).load(portfolioId, p.assetId),
      ]),
    ),
  );
  return (
    <>
      <PageHeading
        eyebrow={w.portfolio.name}
        title="სტრატეგია"
        description="დაგეგმეთ დამატებითი შესყიდვა და კაპიტალის ეტაპობრივი ამოღება."
      />
      <StrategyWorkspace
        summary={w.summary}
        portfolioId={portfolioId}
        data={data}
      />
    </>
  );
}
