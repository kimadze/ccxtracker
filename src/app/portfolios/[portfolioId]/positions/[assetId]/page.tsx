import { notFound } from "next/navigation";
import { loadWorkspace } from "@/server/workspace";
import { PageHeading } from "@/components/shell";
import { PositionWorkspace } from "@/components/position-workspace";
import { strategyService } from "@/server/services/strategy";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { Attachments } from "@/components/attachments";
import { journalAttachments } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import { TransactionForm } from "@/components/transaction-form";
export default async function Page({ params }: { params: Promise<{ portfolioId: string; assetId: string }> }) {
  const { portfolioId, assetId } = await params; const w = await loadWorkspace(portfolioId);
  const p = w.summary.positions.find(p => p.assetId === assetId); if (!p) notFound();
  const user = await requireUser(); const data = await strategyService(getDb(), user.id).load(portfolioId, assetId);
  const files = data.journal ? await getDb().select({ id: journalAttachments.id, name: journalAttachments.name, size: journalAttachments.size }).from(journalAttachments).where(and(eq(journalAttachments.portfolioId, portfolioId), eq(journalAttachments.journalId, data.journal.id))) : [];
  return <><PageHeading eyebrow={`${w.portfolio.name} / ${p.asset.symbol}`} title={p.asset.name} description="პოზიციის შედეგები, გეგმა და საინვესტიციო თეზისი." action={<TransactionForm portfolioId={portfolioId} revision={w.portfolio.revision} assets={w.assets} initialAsset={assetId} />} /><PositionWorkspace position={p} portfolioId={portfolioId} portfolioValue={w.summary.value} revision={w.portfolio.revision} assets={w.assets} entries={w.entries.filter(e => e.assetId === assetId)} plan={data.plan} journal={data.journal} attachments={<Attachments portfolioId={portfolioId} journalId={data.journal?.id ?? null} files={files} enabled={Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID)} />} /></>;
}
