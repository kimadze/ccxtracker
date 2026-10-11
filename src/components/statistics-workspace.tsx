"use client";
import Link from "next/link";
import { WorkspaceTabs, useWorkspaceTab } from "./workspace-tabs";
import { MacroIndicators } from "./macro-indicators";
import { AssetIcon } from "./positions";
import { PortfolioStatistics } from "./portfolio-statistics";
import {
  PortfolioAnalysis,
  type PortfolioAnalysisData,
} from "./portfolio-analysis";
import type { PortfolioSummary } from "@/domain/types";
import type { MacroStatistics } from "@/domain/statistics";
import { portfolioPriceImpact } from "@/domain/price-impact";
import { money, percentage, pnlClass } from "@/lib/formatters";
import { BalanceValue } from "./ui";

function ImpactRows({
  title,
  rows,
  portfolioId,
}: {
  title: string;
  rows: ReturnType<typeof portfolioPriceImpact>["gainers"];
  portfolioId: string;
}) {
  return (
    <section className="min-w-0">
      <h3 className="mb-1 text-xs font-medium text-base-content/60">{title}</h3>
      {rows.length ? (
        <ul className="list divide-y divide-base-300">
          {rows.map((row) => (
            <li key={row.position.assetId}>
              <Link
                href={`/portfolios/${portfolioId}/positions/${row.position.assetId}`}
                className="list-row min-h-11 items-center rounded-field px-1 py-2 hover:bg-base-300/40 focus-visible:outline-2 focus-visible:outline-primary"
              >
                <AssetIcon
                  symbol={row.position.asset.symbol}
                  logoUrl={row.position.asset.logoUrl}
                  size={28}
                />
                <span
                  className="list-col-grow min-w-0"
                  title={row.position.asset.name}
                >
                  <strong className="block truncate text-sm">
                    {row.position.asset.symbol}
                  </strong>
                  <span className={`numeric text-xs ${pnlClass(row.change)}`}>
                    {percentage(row.change, true)}
                  </span>
                </span>
                <span
                  className={`numeric max-w-44 overflow-x-auto whitespace-nowrap text-right text-sm ${pnlClass(row.impact)}`}
                >
                  <BalanceValue>{money(row.impact)}</BalanceValue>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-2 text-xs text-base-content/55">მონაცემი არ არის.</p>
      )}
    </section>
  );
}

function PriceImpact({
  summary,
  portfolioId,
}: {
  summary: PortfolioSummary;
  portfolioId: string;
}) {
  const data = portfolioPriceImpact(summary);
  if (!data.total) return null;
  return (
    <section
      className="card min-w-0 bg-base-200"
      aria-labelledby="price-impact-heading"
    >
      <div className="card-body gap-3 p-3 sm:p-4">
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 id="price-impact-heading" className="text-base font-semibold">
              ფასის გავლენა · 24სთ
            </h2>
            <p className="mt-1 text-xs text-base-content/55">
              მიმდინარე რაოდენობით შეფასება · არ არის პერიოდის სრული P/L.
            </p>
          </div>
          <span
            className={`numeric max-w-full overflow-x-auto whitespace-nowrap text-lg font-semibold ${pnlClass(data.knownImpact)}`}
          >
            <BalanceValue>{money(data.knownImpact)}</BalanceValue>
          </span>
        </header>
        <div className="grid gap-3 md:grid-cols-2 md:gap-4">
          <ImpactRows
            title="დადებითი გავლენა"
            rows={data.gainers}
            portfolioId={portfolioId}
          />
          <ImpactRows
            title="უარყოფითი გავლენა"
            rows={data.losers}
            portfolioId={portfolioId}
          />
        </div>
        {data.missing > 0 && (
          <p className="text-xs text-warning">
            არასრული ჯამი · შეფასებულია {data.covered}/{data.total} აქტივი.
          </p>
        )}
      </div>
    </section>
  );
}
export function StatisticsWorkspace({
  macro,
  summary,
  portfolioId,
  analysis = null,
}: {
  macro: MacroStatistics | null;
  summary: PortfolioSummary;
  portfolioId: string;
  analysis?: PortfolioAnalysisData | null;
}) {
  const [tab, setTab] = useWorkspaceTab(["macro", "portfolio"], "portfolio");
  return (
    <WorkspaceTabs
      label="სტატისტიკის კატეგორია"
      value={tab}
      onChange={setTab}
      items={[
        ["portfolio", "ჩემი პორტფელი"],
        ["macro", "მაკრო"],
      ]}
    >
      <div className="space-y-3 lg:space-y-4">
        {tab === "macro" &&
          (macro ? (
            <MacroIndicators data={macro} />
          ) : (
            <p role="status" className="text-sm text-base-content/60">
              მონაცემები იტვირთება…
            </p>
          ))}
        {tab === "portfolio" && (
          <>
            {analysis && (
              <PortfolioAnalysis
                summary={summary}
                portfolioId={portfolioId}
                data={analysis}
              />
            )}
            <PriceImpact summary={summary} portfolioId={portfolioId} />
            <PortfolioStatistics summary={summary} portfolioId={portfolioId} />
          </>
        )}
      </div>
    </WorkspaceTabs>
  );
}
