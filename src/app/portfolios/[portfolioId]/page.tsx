import { loadWorkspace } from "@/server/workspace";
import { Overview } from "@/components/overview";
import { getDb } from "@/server/db";
import { snapshots } from "@/server/db/schema";
import { eq, asc } from "drizzle-orm";
import { HistoryChart } from "@/components/history-chart";
import { TransactionForm } from "@/components/transaction-form";
export default async function Page({
  params,
}: {
  params: Promise<{ portfolioId: string }>;
}) {
  const { portfolioId } = await params;
  const w = await loadWorkspace(portfolioId);
  const history = await getDb()
    .select()
    .from(snapshots)
    .where(eq(snapshots.portfolioId, portfolioId))
    .orderBy(asc(snapshots.capturedAt));
  return (
    <>
      <Overview
        summary={w.summary}
        base={`/portfolios/${portfolioId}`}
        action={<TransactionForm portfolioId={portfolioId} revision={w.portfolio.revision} assets={w.assets} />}
        history={
          <HistoryChart
            snapshots={history
              .slice(-30)
              .map((s) => ({ ...s, capturedAt: s.capturedAt.toISOString() }))}
          />
        }
      />
    </>
  );
}
