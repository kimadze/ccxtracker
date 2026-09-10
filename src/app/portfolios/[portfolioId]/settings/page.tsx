import { loadWorkspace } from "@/server/workspace";
import { requireUser } from "@/server/auth";
import { PageHeading } from "@/components/shell";
import { Settings } from "@/components/settings";
export default async function Page({
  params,
}: {
  params: Promise<{ portfolioId: string }>;
}) {
  const { portfolioId } = await params;
  const w = await loadWorkspace(portfolioId);
  const user = await requireUser();
  const dates = w.summary.positions
    .flatMap((p) => (p.quote ? [p.quote.updatedAt] : []))
    .sort();
  return (
    <>
      <PageHeading
        eyebrow={w.portfolio.name}
        title="პარამეტრები"
        description="პროფილი, პორტფელი და მონაცემების მართვა."
      />
      <Settings
        portfolioId={portfolioId}
        portfolioName={w.portfolio.name}
        user={{ name: user.name, email: user.email }}
        marketConfigured={!!process.env.COINGECKO_DEMO_API_KEY}
        lastQuote={dates.at(-1) ?? null}
      />
    </>
  );
}
