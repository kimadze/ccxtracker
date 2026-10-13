import { loadWorkspace } from "@/server/workspace";
import { Overview } from "@/components/overview";
import { getDb } from "@/server/db";
import { requireUser } from "@/server/auth";
import { loadNextSteps } from "@/server/services/next-steps";
import { NextSteps } from "@/components/next-steps";
import { TransactionForm } from "@/components/transaction-form";
export default async function Page({
  params,
}: {
  params: Promise<{ portfolioId: string }>;
}) {
  const { portfolioId } = await params;
  const w = await loadWorkspace(portfolioId);
  const user = await requireUser();
  const steps = await loadNextSteps(getDb(), user.id, portfolioId, w.summary);
  return (
    <>
      <Overview
        summary={w.summary}
        portfolioName={w.portfolio.name}
        cryptoOnlyValue={w.settings.cryptoOnlyPortfolioValue}
        base={`/portfolios/${portfolioId}`}
        action={
          <TransactionForm
            portfolioId={portfolioId}
            revision={w.portfolio.revision}
            assets={w.assets}
          />
        }
        nextSteps={<NextSteps {...steps} base={`/portfolios/${portfolioId}`} />}
      />
    </>
  );
}
