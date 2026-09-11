import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell, PageHeading } from "@/components/shell";
import {
  demoSummary,
  demoAssets,
  demoQuotes,
  demoHistory,
  demoEntries,
} from "@/domain/demo";
import { PositionsWorkspace } from "@/components/positions-workspace";
import { Analytics } from "@/components/analytics";
import { StrategyWorkspace } from "@/components/strategy-workspace";
import { ScenarioLab } from "@/components/scenario-lab";
import { AllocationWorkspace } from "@/components/allocation-workspace";
import { Watchlist } from "@/components/watchlist";
import { Settings } from "@/components/settings";
import { StatisticsWorkspace } from "@/components/statistics-workspace";
const titles: Record<string, string> = {
  positions: "პოზიციები",
  transactions: "ტრანზაქციები",
  analytics: "ანალიტიკა",
  statistics: "სტატისტიკა",
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
        <Analytics
          summary={demoSummary}
          snapshots={demoHistory}
          entries={demoEntries}
          assets={demoAssets}
        />
      )}
      {section === "statistics" && (
        <StatisticsWorkspace
          base="/preview"
          summary={demoSummary}
          selectedAssetIds={["chainlink"]}
          market={{
            error: false,
            overview: {
              totalMarketCap: "3840000000000",
              volume24h: "142000000000",
              btcDominance: "56.4",
              ethDominance: "13.1",
              stablecoinMarketCap: "305000000000",
              updatedAt: "2026-09-10T08:00:00.000Z",
              source: "სადემონსტრაციო მონაცემები",
            },
            assets: demoAssets.map((asset, index) => ({
              id: asset.id,
              symbol: asset.symbol,
              name: asset.name,
              image: null,
              rank: index + 1,
              price: demoQuotes[index].price,
              change1h: ["0.4", "-0.2", "0.8", "0.1", "0"][index],
              change24h: demoQuotes[index].change24h,
              change7d: ["5.2", "2.1", "-3.4", "6.8", "0.02"][index],
              marketCap: String(1900000000000 / (index + 1)),
              volume24h: String(48000000000 / (index + 1)),
              circulatingSupply: String(20000000 * (index + 1)),
              sparkline7d: Array.from({ length: 24 }, (_, point) => 100 + point * (index % 2 ? -0.2 : 0.4) + Math.sin(point) * 2),
            })),
          }}
          macro={{
            error: false,
            fetchedAt: "2026-09-10T08:00:00.000Z",
            events: [],
            metrics: [
              { id: "FED_FUNDS", label: "FED განაკვეთი", value: "4.25", unit: "%", observationDate: "2026-08-01", source: "სადემონსტრაციო FRED", change: "0" },
              { id: "CPI_YOY", label: "CPI YoY", value: "2.9", unit: "%", observationDate: "2026-08-01", source: "სადემონსტრაციო FRED", change: "-0.1" },
              { id: "CORE_CPI_YOY", label: "Core CPI YoY", value: "3.1", unit: "%", observationDate: "2026-08-01", source: "სადემონსტრაციო FRED", change: "0" },
              { id: "UNEMPLOYMENT", label: "უმუშევრობა", value: "4.2", unit: "%", observationDate: "2026-08-01", source: "სადემონსტრაციო FRED", change: "0.1" },
            ],
          }}
        />
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
