import { Watchlist } from "@/components/watchlist";
import { loadWorkspace } from "@/server/workspace";
import { Overview } from "@/components/overview";
import { getDb } from "@/server/db";
import { snapshots } from "@/server/db/schema";
import { eq, asc } from "drizzle-orm";
import { HistoryChart } from "@/components/history-chart";
import { TransactionForm } from "@/components/transaction-form";
import { CaptureInitialSnapshot } from "@/components/capture-initial-snapshot";
import { OverviewTransactions } from "@/components/overview-transactions";
import { testPortfolioHistory } from "@/domain/test-portfolio-history";
import { requireUser } from "@/server/auth";
import { getQuotes } from "@/server/market";
import { watchlistService } from "@/server/services/watchlist";
import { PortfolioAttention } from "@/components/portfolio-attention";
export default async function Page({
  params,
}: {
  params: Promise<{ portfolioId: string }>;
}) {
  const { portfolioId } = await params;
  const w = await loadWorkspace(portfolioId);
  const user = await requireUser();
  const base = `/portfolios/${portfolioId}`;
  const demoHistory = testPortfolioHistory(portfolioId, w.summary.knownValue);
  const db = getDb();
  const [history, watchlist] = await Promise.all([
    db
      .select()
      .from(snapshots)
      .where(eq(snapshots.portfolioId, portfolioId))
      .orderBy(asc(snapshots.capturedAt)),
    watchlistService(db, user.id).list(portfolioId),
  ]);
  const items = watchlist.sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  const quotes = await getQuotes(items.map(({ asset }) => asset));
  return (
    <Overview
      overviewAttention={
        <PortfolioAttention
          base={base}
          positions={w.summary.positions}
          items={items}
          watchlistPanel={
            <Watchlist
              portfolioId={portfolioId}
              revision={w.portfolio.revision}
              assets={w.assets}
              items={items.map((item) => ({
                ...item,
                createdAt: item.createdAt.toISOString(),
                targetReachedAt: item.targetReachedAt?.toISOString() ?? null,
                sellTargetReachedAt: item.sellTargetReachedAt?.toISOString() ?? null,
              }))}
              quotes={quotes}
            />
          }
          quotes={quotes}
        />
      }
      portfolioId={portfolioId}
      summary={w.summary}
      portfolioName={w.portfolio.name}
      cryptoOnlyValue={w.settings.cryptoOnlyPortfolioValue}
      base={base}
      transactionsPanel={
        <OverviewTransactions entries={w.entries} assets={w.assets} />
      }
      action={
        <TransactionForm
          portfolioId={portfolioId}
          revision={w.portfolio.revision}
          assets={w.assets}
          preferredAssetIds={w.summary.positions.map(
            (position) => position.asset.id,
          )}
        />
      }
      history={
        <HistoryChart
          compact
          dashboard
          illustrative={demoHistory !== null}
          snapshots={
            demoHistory ??
            history.map((s) => ({
              ...s,
              capturedAt: s.capturedAt.toISOString(),
            }))
          }
          emptyAction={<CaptureInitialSnapshot portfolioId={portfolioId} />}
        />
      }
    />
  );
}
