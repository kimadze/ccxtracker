import { loadWorkspace } from "@/server/workspace";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { watchlistService } from "@/server/services/watchlist";
import { getQuotes } from "@/server/market";
import { Watchlist } from "@/components/watchlist";
import { PageHeading } from "@/components/shell";
export default async function Page({
  params,
}: {
  params: Promise<{ portfolioId: string }>;
}) {
  const { portfolioId } = await params;
  const w = await loadWorkspace(portfolioId);
  const user = await requireUser();
  const items = await watchlistService(getDb(), user.id).list(portfolioId);
  return (
    <>
      <PageHeading
        eyebrow={w.portfolio.name}
        title="დაკვირვების სია"
        description="აქტივები, რომლებსაც აკვირდებით — რეალური პოზიციებისგან დამოუკიდებლად."
      />
      <Watchlist
        portfolioId={portfolioId}
        assets={w.assets}
        items={items.map((i) => ({
          ...i,
          createdAt: i.createdAt.toISOString(),
        }))}
        quotes={await getQuotes(items.map((i) => i.asset))}
      />
    </>
  );
}
