import { loadWorkspace } from "@/server/workspace";
import { Overview } from "@/components/overview";
import { getDb } from "@/server/db";
import { snapshots } from "@/server/db/schema";
import { eq, asc } from "drizzle-orm";
import { HistoryChart } from "@/components/history-chart";
import { TransactionForm } from "@/components/transaction-form";
import { CaptureInitialSnapshot } from "@/components/capture-initial-snapshot";
import { PositionsWorkspace } from "@/components/positions-workspace";
import { TransactionList } from "@/components/transaction-list";
import { saleResults } from "@/domain/ledger";
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
        portfolioName={w.portfolio.name}
        cryptoOnlyValue={w.settings.cryptoOnlyPortfolioValue}
        base={`/portfolios/${portfolioId}`}
        positionsPanel={
          <PositionsWorkspace
            positions={w.summary.positions}
            base={`/portfolios/${portfolioId}`}
            assets={w.assets}
            revision={w.portfolio.revision}
          />
        }
        transactionsPanel={
          <TransactionList
            embedded
            entries={w.entries}
            sales={saleResults(w.entries)}
            assets={w.assets}
            portfolioId={portfolioId}
            revision={w.portfolio.revision}
          />
        }
        action={
          <TransactionForm
            portfolioId={portfolioId}
            revision={w.portfolio.revision}
            assets={w.assets}
          />
        }
        history={
          <HistoryChart
            compact
            dashboard
            snapshots={history.map((s) => ({
              ...s,
              capturedAt: s.capturedAt.toISOString(),
            }))}
            emptyAction={<CaptureInitialSnapshot portfolioId={portfolioId} />}
          />
        }
      />
    </>
  );
}
