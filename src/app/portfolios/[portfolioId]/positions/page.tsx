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
        description="აქტივები, თვითღირებულება და მიმდინარე შედეგები."
        action={
          <TransactionForm
            portfolioId={portfolioId}
            revision={w.portfolio.revision}
            assets={w.assets}
            opening
          />
        }
      />
      <PositionsWorkspace
        positions={w.summary.positions}
        base={`/portfolios/${portfolioId}`}
      />
      <p className="mt-5 text-xs leading-6 text-muted">
        რაოდენობის ან თვითღირებულების შესაცვლელად გახსენით პოზიცია და შეასწორეთ
        შესაბამისი ტრანზაქცია.
      </p>
    </>
  );
}
