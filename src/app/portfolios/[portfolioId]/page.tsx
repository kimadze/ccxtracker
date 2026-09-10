import { loadWorkspace } from "@/server/workspace";
import { Overview } from "@/components/overview";
import { PageHeading } from "@/components/shell";
import { TransactionForm } from "@/components/transaction-form";
import { getDb } from "@/server/db";
import { snapshots } from "@/server/db/schema";
import { eq, asc } from "drizzle-orm";
import { HistoryChart } from "@/components/history-chart";
export default async function Page({ params }: { params: Promise<{ portfolioId: string }> }) {
  const { portfolioId } = await params; const w = await loadWorkspace(portfolioId);
  const history = await getDb().select().from(snapshots).where(eq(snapshots.portfolioId, portfolioId)).orderBy(asc(snapshots.capturedAt));
  return <><PageHeading eyebrow={w.portfolio.name} title="პორტფელის მიმოხილვა" description="თქვენი ინვესტიციები — ერთიან და მკაფიო სურათში." action={<TransactionForm portfolioId={portfolioId} revision={w.portfolio.revision} assets={w.assets} />} /><Overview summary={w.summary} base={`/portfolios/${portfolioId}`} history={<HistoryChart snapshots={history.slice(-30).map(s => ({ ...s, capturedAt: s.capturedAt.toISOString() }))} />} /></>;
}
