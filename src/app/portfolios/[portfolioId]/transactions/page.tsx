import { loadWorkspace } from "@/server/workspace";
import { PageHeading } from "@/components/shell";
import { TransactionList } from "@/components/transaction-list";
import { TransactionForm } from "@/components/transaction-form";
export default async function Page({ params }: { params: Promise<{ portfolioId: string }> }) {
  const { portfolioId } = await params; const w = await loadWorkspace(portfolioId);
  return <><PageHeading eyebrow={w.portfolio.name} title="ტრანზაქციები" description="თქვენი პორტფელის სრული ისტორია და ყველა ცვლილების საფუძველი." action={<TransactionForm portfolioId={portfolioId} revision={w.portfolio.revision} assets={w.assets} />} /><TransactionList entries={w.entries} assets={w.assets} portfolioId={portfolioId} revision={w.portfolio.revision} /></>;
}
