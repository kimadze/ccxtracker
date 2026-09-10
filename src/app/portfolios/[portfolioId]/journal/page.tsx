import { loadWorkspace } from "@/server/workspace";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { strategyService } from "@/server/services/strategy";
import { PageHeading } from "@/components/shell";
import { StrategyWorkspace } from "@/components/strategy-workspace";
import { journalAttachments } from "@/server/db/schema";
import { eq } from "drizzle-orm";
export default async function Page({
  params,
}: {
  params: Promise<{ portfolioId: string }>;
}) {
  const { portfolioId } = await params;
  const w = await loadWorkspace(portfolioId);
  const user = await requireUser();
  const files = await getDb()
    .select({
      id: journalAttachments.id,
      name: journalAttachments.name,
      size: journalAttachments.size,
      journalId: journalAttachments.journalId,
    })
    .from(journalAttachments)
    .where(eq(journalAttachments.portfolioId, portfolioId));
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
        return [
          assetId,
          {
            ...item,
            files: files.filter((file) => file.journalId === item.journal?.id),
          },
        ];
      }),
    ),
  );
  return (
    <>
      <PageHeading
        eyebrow={w.portfolio.name}
        title="საინვესტიციო ჟურნალი"
        description="შეინახეთ თქვენი თეზისები, გადაწყვეტილებების საფუძველი და პირადი დანართები."
      />
      <StrategyWorkspace
        summary={w.summary}
        portfolioId={portfolioId}
        data={data}
        mode="journal"
        journalAssets={journalAssets}
        attachmentsEnabled={Boolean(
          process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID,
        )}
      />
    </>
  );
}
