import { loadWorkspace } from "@/server/workspace";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { allocationService } from "@/server/services/allocation";
import { getQuotes } from "@/server/market";
import { PageHeading } from "@/components/shell";
import { AllocationWorkspace } from "@/components/allocation-workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ portfolioId: string }>;
}) {
  const { portfolioId } = await params;
  const w = await loadWorkspace(portfolioId);
  const user = await requireUser();
  const initial = await allocationService(getDb(), user.id).list(portfolioId);
  const quotes = await getQuotes(
    w.assets.filter(
      (a) =>
        initial.some((r) => r.assetId === a.id) ||
        w.summary.positions.some((p) => p.assetId === a.id),
    ),
  );
  return (
    <>
      <PageHeading
        eyebrow={w.portfolio.name}
        title="განაწილება"
        description="პორტფელის სასურველი სტრუქტურა და ახალი კაპიტალის გამოყენების გეგმა."
      />
      <AllocationWorkspace
        summary={w.summary}
        assets={w.assets}
        quotes={quotes}
        portfolioId={portfolioId}
        initial={initial}
      />
    </>
  );
}
