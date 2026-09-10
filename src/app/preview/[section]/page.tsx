import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell, PageHeading } from "@/components/shell";
import {
  demoSummary,
  demoAssets,
  demoQuotes,
  demoHistory,
} from "@/domain/demo";
import { PositionsWorkspace } from "@/components/positions-workspace";
import { Analytics } from "@/components/analytics";
import { StrategyWorkspace } from "@/components/strategy-workspace";
import { ScenarioLab } from "@/components/scenario-lab";
import { AllocationWorkspace } from "@/components/allocation-workspace";
import { Watchlist } from "@/components/watchlist";
import { Settings } from "@/components/settings";
const titles: Record<string, string> = {
  positions: "პოზიციები",
  transactions: "ტრანზაქციები",
  analytics: "ანალიტიკა",
  scenarios: "სცენარების ლაბორატორია",
  allocation: "განაწილება",
  strategy: "სტრატეგია",
  journal: "საინვესტიციო ჟურნალი",
  watchlist: "დაკვირვების სია",
  settings: "პარამეტრები",
};
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!titles[section]) notFound();
  const assets = [
    {
      id: "USD",
      symbol: "USD",
      name: "აშშ დოლარი",
      providerId: "usd-cash",
      isStablecoin: false,
    },
    ...demoAssets,
  ];
  const weights = ["35", "25", "15", "5", "10"].map((weight, i) => ({
    assetId: demoAssets[i].id,
    weight,
  }));
  const plan = {
    bitcoin: {
      plan: {
        feePercent: "0.1",
        levels: [
          { price: "120000", percentage: "25" },
          { price: "150000", percentage: "35" },
          { price: "180000", percentage: "30" },
        ],
      },
      journal: null,
    },
  };
  return (
    <Shell
      preview
      portfolios={[{ id: "preview", name: "მთავარი პორტფელი" }]}
      userName="დამთვალიერებელი"
    >
      <PageHeading
        eyebrow="სადემონსტრაციო სივრცე"
        title={titles[section]}
        description="გამოცადეთ ხელსაწყოები გამოგონილ პორტფელზე. ცვლილებები არ ინახება."
      />
      {section === "positions" && (
        <PositionsWorkspace
          positions={demoSummary.positions}
          base="/preview"
          preview
        />
      )}
      {section === "analytics" && (
        <Analytics summary={demoSummary} snapshots={demoHistory} entries={[]} />
      )}
      {(section === "strategy" || section === "journal") && (
        <StrategyWorkspace
          summary={demoSummary}
          portfolioId="preview"
          data={plan}
          mode={section}
          preview
        />
      )}
      {section === "scenarios" && (
        <ScenarioLab
          summary={demoSummary}
          portfolioId="preview"
          saved={[]}
          goal={{ target: "100000", milestones: ["50000", "75000"] }}
          preview
        />
      )}
      {section === "allocation" && (
        <AllocationWorkspace
          summary={demoSummary}
          assets={assets}
          quotes={demoQuotes}
          portfolioId="preview"
          initial={[...weights, { assetId: "USD", weight: "10" }]}
          preview
        />
      )}
      {section === "watchlist" && (
        <Watchlist
          portfolioId="preview"
          assets={assets}
          items={[]}
          quotes={[]}
          preview
        />
      )}
      {section === "settings" && (
        <Settings
          portfolioId="preview"
          portfolioName="მთავარი პორტფელი"
          user={{ name: "დამთვალიერებელი", email: "preview@example.test" }}
          marketConfigured={false}
          lastQuote={null}
          preview
        />
      )}
      {section === "transactions" && (
        <div className="panel p-10 text-center">
          <h2 className="text-sm font-medium">ტრანზაქციების პირადი ისტორია</h2>
          <p className="mt-4 mb-7 text-xs leading-6 text-muted">
            რეალური ტრანზაქციების ჩასაწერად შექმენით საკუთარი პორტფელი.
          </p>
          <Link href="/login" className="button-primary">
            ანგარიშში შესვლა
          </Link>
        </div>
      )}
    </Shell>
  );
}
