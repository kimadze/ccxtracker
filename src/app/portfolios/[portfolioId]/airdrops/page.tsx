import { AirdropWorkspace } from "@/components/airdrop-workspace";
import { PageHeading } from "@/components/shell";
import { TransactionForm } from "@/components/transaction-form";
import { loadWorkspace } from "@/server/workspace";

export default async function Page({ params }: { params: Promise<{ portfolioId: string }> }) {
  const { portfolioId } = await params;
  const workspace = await loadWorkspace(portfolioId);
  return <><PageHeading eyebrow={workspace.portfolio.name} title="ეირდროპები" description="მიღებული აქტივები, საწყისი ღირებულება და ბაზრის ცვლილება." action={<TransactionForm portfolioId={portfolioId} revision={workspace.portfolio.revision} assets={workspace.assets} initialKind="airdrop" triggerLabel="ეირდროპის დამატება" />} /><AirdropWorkspace entries={workspace.entries} assets={workspace.assets} summary={workspace.summary} portfolioId={portfolioId} revision={workspace.portfolio.revision} /></>;
}
