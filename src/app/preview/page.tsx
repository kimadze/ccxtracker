import { Shell } from "@/components/shell";
import { Overview } from "@/components/overview";
import { demoSummary, demoHistory } from "@/domain/demo";
import { HistoryChart } from "@/components/history-chart";
export default function Preview() {
  return (
    <Shell
      preview
      portfolios={[{ id: "preview", name: "მთავარი პორტფელი" }]}
      userName="დამთვალიერებელი"
    >
      <Overview
        summary={demoSummary}
        base="/preview"
        preview
        history={<HistoryChart snapshots={demoHistory} illustrative />}
      />
    </Shell>
  );
}
