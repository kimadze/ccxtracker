import { loadWorkspace } from "@/server/workspace";
import { PageHeading } from "@/components/shell";
import { PositionsWorkspace } from "@/components/positions-workspace";
import { TransactionForm } from "@/components/transaction-form";
export default async function Page({
  params,
}: {
  params: Promise<{ portfolioId: string }>;
}) {
  const { portfolioId } = await params;
  const w = await loadWorkspace(portfolioId);
  return (
    <>
      <PageHeading
        eyebrow={w.portfolio.name}
        title="პოზიციები"
        description="მოძებნეთ, შეადარეთ და მართეთ ყველა ღია პოზიცია ერთ სამუშაო სივრცეში."
        action={
          <TransactionForm
            portfolioId={portfolioId}
            revision={w.portfolio.revision}
            assets={w.assets}
            opening
          />
        }
      />
      {(!w.summary.complete || w.summary.stale) && (
        <div
          role="status"
          className="alert alert-warning alert-soft mb-3 text-xs"
        >
          {!w.summary.complete ? "ფასები არასრულია" : "ფასები მოძველებულია"}
        </div>
      )}
      <PositionsWorkspace
        positions={w.summary.positions}
        base={`/portfolios/${portfolioId}`}
        assets={w.assets}
        revision={w.portfolio.revision}
      />
    </>
  );
}
