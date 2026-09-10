import { loadWorkspace } from "@/server/workspace";
import { getDb } from "@/server/db";
import { snapshots } from "@/server/db/schema";
import { eq, asc } from "drizzle-orm";
import { PageHeading } from "@/components/shell";
import { Analytics } from "@/components/analytics";
export default async function Page({
  params,
}: {
  params: Promise<{ portfolioId: string }>;
}) {
  const { portfolioId } = await params;
  const w = await loadWorkspace(portfolioId);
  const history = await getDb()
    .select()
    .from(snapshots)
    .where(eq(snapshots.portfolioId, portfolioId))
    .orderBy(asc(snapshots.capturedAt));
  return (
    <>
      <PageHeading
        eyebrow={w.portfolio.name}
        title="ანალიტიკა"
        description="შედეგები, კონცენტრაცია და პორტფელის მდგომარეობა."
      />
      <Analytics
        summary={w.summary}
        entries={w.entries}
        assets={w.assets}
        snapshots={history.map((s) => ({
          ...s,
          capturedAt: s.capturedAt.toISOString(),
        }))}
      />
    </>
  );
}
