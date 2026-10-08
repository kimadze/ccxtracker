"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { PortfolioSummary } from "@/domain/types";
import type { PortfolioAttribution } from "@/domain/attribution";
import { analyzeHealth, type analyzePerformance } from "@/domain/analytics";
import { decimal } from "@/domain/decimal";
import { money, percentage, pnlClass, dateTime } from "@/lib/formatters";
import { BalanceValue } from "./ui";

const Attribution = dynamic(
  () =>
    import("./performance-attribution").then((m) => m.PerformanceAttribution),
  {
    loading: () => (
      <span
        className="loading loading-spinner loading-sm"
        aria-label="იტვირთება"
      />
    ),
  },
);
export type PortfolioAnalysisData = {
  attribution: PortfolioAttribution;
  performance: Pick<
    ReturnType<typeof analyzePerformance>,
    "valid" | "returnPercent" | "maxDrawdown"
  >;
  from: string | null;
  to: string | null;
};

export function PortfolioAnalysis({
  summary,
  portfolioId,
  data,
}: {
  summary: PortfolioSummary;
  portfolioId: string;
  data: PortfolioAnalysisData;
}) {
  const [expanded, setExpanded] = useState(false);
  const health = analyzeHealth(summary);
  const openPositions = summary.positions.filter((p) =>
    decimal(p.quantity).gt(0),
  );
  const missing = openPositions.filter((p) => p.value === null || !p.quote);
  const stale = openPositions.filter((p) => p.quote?.stale);
  const netCapital =
    summary.contributions !== null && summary.withdrawals !== null
      ? decimal(summary.contributions).minus(summary.withdrawals).toString()
      : null;
  const reliable =
    data.attribution.complete && data.attribution.reconciled && !summary.stale;
  const sourceRows = [...data.attribution.assets]
    .filter((row) => row.totalPnl !== null)
    .sort((a, b) => decimal(b.totalPnl!).abs().cmp(decimal(a.totalPnl!).abs()))
    .slice(0, 6)
    .map((row) => ({ label: row.name, row }));
  const largestContribution = sourceRows.reduce(
    (max, { row }) =>
      decimal(row.totalPnl!).abs().gt(max) ? decimal(row.totalPnl!).abs() : max,
    decimal(0),
  );
  return (
    <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-4">
      <section
        className="card min-w-0 bg-base-200 lg:col-span-2"
        aria-labelledby="capital-heading"
      >
        <div className="card-body gap-3 p-3 sm:p-4">
          <h2 id="capital-heading" className="text-base font-semibold">
            კაპიტალი და შედეგი
          </h2>
          <div className="grid grid-cols-2 items-end gap-4 lg:grid-cols-[2fr_1fr_1fr]">
            {[
              ["სრული P/L", summary.totalPnl],
              ["მიმდინარე ღირებულება", summary.value],
              ["წმინდა შეტანილი კაპიტალი", netCapital],
            ].map(([label, value], i) => (
              <div
                key={label}
                className={`stat min-w-0 p-0 ${i === 0 ? "col-span-2 lg:col-span-1" : ""}`}
              >
                <span className="stat-title whitespace-normal text-xs">
                  {label}
                </span>
                <span
                  className={`stat-value mt-1 overflow-x-auto whitespace-nowrap tabular-nums ${i === 0 ? `text-[32px] lg:text-[40px] ${pnlClass(value)}` : "text-lg font-medium"}`}
                >
                  <BalanceValue>{money(value)}</BalanceValue>
                </span>
              </div>
            ))}
          </div>
          {summary.stale && (
            <p role="status" className="text-xs text-warning">
              შედეგი მოძველებულ ფასებს შეიცავს.
            </p>
          )}
          <details className="collapse collapse-arrow rounded-none border-t border-base-300">
            <summary className="collapse-title min-h-11 py-3 text-xs">
              კაპიტალის მოძრაობა და შემოსავლიანობა
            </summary>
            <div className="collapse-content space-y-3 text-xs">
              <dl className="grid grid-cols-2 gap-3">
                {[
                  ["შეტანილი კაპიტალი", summary.contributions],
                  ["გატანილი კაპიტალი", summary.withdrawals],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-base-content/60">{label}</dt>
                    <dd className="mt-1 overflow-x-auto whitespace-nowrap tabular-nums">
                      <BalanceValue>{money(value)}</BalanceValue>
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="text-base-content/60">
                გადმოტანილი აქტივები აღირიცხება ცნობილი თვითღირებულებით. უცნობი
                მონაცემი — „—“.
              </p>
              {data.performance.valid ? (
                <>
                  <dl className="grid grid-cols-2 gap-3">
                    <div>
                      <dt className="text-base-content/60">
                        შემოსავლიანობის შეფასება
                      </dt>
                      <dd
                        className={`mt-1 tabular-nums ${pnlClass(data.performance.returnPercent)}`}
                      >
                        <BalanceValue>
                          {percentage(data.performance.returnPercent, true)}
                        </BalanceValue>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-base-content/60">
                        მაქსიმალური ვარდნა
                      </dt>
                      <dd className="mt-1 tabular-nums">
                        <BalanceValue>
                          {percentage(data.performance.maxDrawdown)}
                        </BalanceValue>
                      </dd>
                    </div>
                  </dl>
                  <p className="text-base-content/60">
                    {data.from && dateTime(data.from)} —{" "}
                    {data.to && dateTime(data.to)}. მიახლოებითი შეფასება
                    (Modified Dietz), USD შეტანა/გატანის გათვალისწინებით.
                  </p>
                </>
              ) : (
                <p role="status" className="text-base-content/60">
                  შემოსავლიანობის შეფასებისთვის ისტორია არასაკმარისია ან შეიცავს
                  გამოტოვებებს/აქტივების გადატანას.
                </p>
              )}
            </div>
          </details>
        </div>
      </section>
      <section
        className="card min-w-0 bg-base-200"
        aria-labelledby="sources-heading"
      >
        <div className="card-body gap-3 p-3 sm:p-4">
          <h2 id="sources-heading" className="text-base font-semibold">
            რა ქმნის მოგებას და ზარალს
          </h2>
          {reliable ? (
            <div className="divide-y divide-base-300">
              {sourceRows.map(({ label, row }) => {
                const content = (
                  <>
                    <span className="text-xs text-base-content/60">
                      {label}
                    </span>
                    <span className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
                      <strong className="text-sm">{row?.symbol ?? "—"}</strong>
                      <span
                        className={`whitespace-nowrap tabular-nums ${pnlClass(row?.totalPnl ?? null)}`}
                      >
                        <BalanceValue>
                          {money(row?.totalPnl ?? null)}
                        </BalanceValue>
                      </span>
                    </span>
                    <div
                      aria-hidden="true"
                      className="mt-2 h-1 overflow-hidden rounded-full bg-base-300"
                    >
                      <div
                        className={`h-full ${decimal(row.totalPnl!).gte(0) ? "bg-success/70" : "bg-error/70"}`}
                        style={{
                          width: `${largestContribution.isZero() ? 0 : decimal(row.totalPnl!).abs().div(largestContribution).times(100).toNumber()}%`,
                        }}
                      />
                    </div>
                  </>
                );
                return row && !row.isFee ? (
                  <Link
                    key={label}
                    className="block min-h-11 py-3 hover:text-secondary focus-visible:outline-2 focus-visible:outline-primary"
                    href={`/portfolios/${portfolioId}/positions/${row.assetId}`}
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={label} className="py-3">
                    {content}
                  </div>
                );
              })}
            </div>
          ) : (
            <p role="status" className="text-xs text-warning">
              სანდო განაწილებისთვის საჭიროა განახლებული ფასები და სრული
              თვითღირებულება.
            </p>
          )}
          <p className="text-xs text-base-content/60">
            სრული პერიოდი · რეალიზებული და არარეალიზებული P/L.
          </p>
          <details
            className="collapse collapse-arrow rounded-none border-t border-base-300"
            onToggle={(e) => setExpanded(e.currentTarget.open)}
          >
            <summary className="collapse-title min-h-11 py-3 text-xs">
              ყველა აქტივის წვლილი და სექტორები
            </summary>
            <div className="collapse-content min-w-0">
              {expanded && reliable && (
                <Attribution attribution={data.attribution} />
              )}
              {expanded && !reliable && (
                <p className="text-xs text-base-content/60">
                  სრული განაწილება დროებით მიუწვდომელია.
                </p>
              )}
            </div>
          </details>
        </div>
      </section>
      <section
        className="card min-w-0 bg-base-200"
        aria-labelledby="risk-heading"
      >
        <div className="card-body gap-3 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 id="risk-heading" className="text-base font-semibold">
              სად არის მთავარი რისკი
            </h2>
            <Link
              className="btn btn-ghost text-xs"
              href={`/portfolios/${portfolioId}/allocation`}
            >
              განაწილება ↗
            </Link>
          </div>
          {health ? (
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs text-base-content/60">
                  უდიდესი წილი კრიპტოში · {health.largestSymbol}
                </dt>
                <dd className="mt-1 font-semibold tabular-nums">
                  {percentage(health.largest)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-base-content/60">
                  Top 3-ის წილი კრიპტოში
                </dt>
                <dd className="mt-1 font-semibold tabular-nums">
                  {percentage(health.topThree)}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-xs text-base-content/60">
              {!openPositions.length
                ? "აქტიური პოზიცია არ არის."
                : "კონცენტრაციის შეფასება მიუწვდომელია."}
            </p>
          )}
          {health && (
            <p
              className={`text-xs ${health.concentration === "low" ? "text-base-content/60" : "text-warning"}`}
            >
              კონცენტრაცია:{" "}
              {health.concentration === "high"
                ? "მაღალი"
                : health.concentration === "medium"
                  ? "საშუალო"
                  : "დაბალი"}{" "}
              · ქეშისა და სტეიბლკოინების გარეშე.
            </p>
          )}
          <div className="flex flex-wrap gap-2 text-xs">
            <span
              className={`badge badge-outline ${missing.length ? "badge-warning" : ""}`}
            >
              ფასის გარეშე: {missing.length}
            </span>
            <span
              className={`badge badge-outline ${stale.length ? "badge-warning" : ""}`}
            >
              მოძველებული: {stale.length}
            </span>
          </div>
          {missing.length + stale.length > 0 && (
            <ul className="list">
              {openPositions
                .filter((p) => missing.includes(p) || stale.includes(p))
                .map((p) => (
                  <li key={p.assetId}>
                    <Link
                      className="flex min-h-11 items-center justify-between gap-2 rounded-field px-2 text-xs hover:bg-base-300"
                      href={`/portfolios/${portfolioId}/positions/${p.assetId}`}
                    >
                      <span>{p.asset.symbol}</span>
                      <span className="text-warning">
                        {missing.includes(p)
                          ? "ფასი მიუწვდომელია"
                          : "ფასი მოძველებულია"}
                      </span>
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
