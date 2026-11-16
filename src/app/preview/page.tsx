import { Overview } from "@/components/overview";
import { HistoryChart } from "@/components/history-chart";
import { demoSummary, demoHistory } from "@/domain/demo";

export default function PreviewPage() {
  const end = Date.parse(demoHistory.at(-1)!.capturedAt);
  const now = Date.now();
  const snapshots = demoHistory.map((snapshot) => ({ ...snapshot, capturedAt: new Date(now + Date.parse(snapshot.capturedAt) - end).toISOString() }));
  return (
    <main id="main" className="mx-auto w-full max-w-7xl space-y-4 px-4 py-6 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-base-300 pb-4">
        <div><p className="text-sm text-secondary">Crypto Collective X</p><p className="text-xl font-semibold">სატესტო პორტფელი</p></div>
        <div id="overview-toolbar" />
      </header>
      <Overview summary={demoSummary} portfolioName="სატესტო პორტფელი" base="/preview" transactionsPanel={<p className="p-4 text-sm">სატესტო მონაცემები</p>} history={<HistoryChart compact dashboard illustrative snapshots={snapshots} />} />
    </main>
  );
}
