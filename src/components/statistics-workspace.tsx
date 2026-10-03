"use client";
import { useState } from "react";
import Link from "next/link";
import { WorkspaceTabs, useWorkspaceTab } from "./workspace-tabs";
import { MacroIndicators } from "./macro-indicators";
import { StatisticsTrend } from "./statistics-trend";
import { AssetIcon } from "./positions";
import { PortfolioStatistics } from "./portfolio-statistics";
import type { PortfolioSummary } from "@/domain/types";
import {
  marketBreadth,
  marketChange,
  topMovers,
  type MarketPeriod,
  type MacroStatistics,
  type MarketStatisticAsset,
  type MarketStatistics,
} from "@/domain/statistics";
import {
  compactMoney,
  dateTime,
  unitPrice,
  percentage,
  pnlClass,
} from "@/lib/formatters";
const periods: [MarketPeriod, string][] = [
  ["1h", "1სთ"],
  ["24h", "24სთ"],
  ["7d", "7დღ"],
];
function PeriodControl({
  period,
  onChange,
}: {
  period: MarketPeriod;
  onChange: (period: MarketPeriod) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-base-content/60">ფასის ცვლილება</span>
      <div
        className="join rounded-field bg-base-200 p-1"
        role="group"
        aria-label="ცვლილების პერიოდი"
      >
        {periods.map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={value === period}
            onClick={() => onChange(value)}
            className={`btn btn-sm min-h-11 join-item px-3 ${value === period ? "btn-soft btn-primary" : "btn-ghost"}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat min-w-0 p-3 sm:p-4">
      <p className="stat-title whitespace-normal text-xs">{label}</p>
      <p className="stat-value numeric mt-1 whitespace-nowrap text-lg sm:text-xl">
        {value}
      </p>
    </div>
  );
}
function AssetRow({
  asset,
  period,
  href,
}: {
  asset: MarketStatisticAsset;
  period: MarketPeriod;
  href?: string;
}) {
  const change = marketChange(asset, period);
  const content = (
    <>
      <span className="flex min-w-0 items-center gap-2">
        <AssetIcon symbol={asset.symbol} logoUrl={asset.image} size={32} />
        <span className="min-w-0">
          <strong className="block truncate text-sm">{asset.symbol}</strong>
          <span
            className="block truncate text-xs text-base-content/55"
            title={asset.name}
          >
            {asset.name}
          </span>
        </span>
      </span>
      <span className="numeric whitespace-nowrap text-right text-xs sm:text-sm">
        {unitPrice(asset.price)}
      </span>
      <span className="w-24 lg:w-full">
        <StatisticsTrend
          values={asset.sparkline7d}
          label={`${asset.symbol} · ფასის 7-დღიანი ისტორია`}
          className="text-base-content/60"
        />
      </span>
      <span
        className={`numeric whitespace-nowrap text-right text-sm ${pnlClass(change)}`}
      >
        {percentage(change, true)}
      </span>
    </>
  );
  const classes =
    "grid min-h-16 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-base-300 px-3 py-2 last:border-0 lg:grid-cols-[minmax(0,1fr)_minmax(100px,auto)_100px_85px] lg:gap-4";
  return (
    <li>
      {href ? (
        <Link
          href={href}
          className={`${classes} rounded-field hover:bg-base-300/40 focus-visible:outline-2 focus-visible:outline-primary`}
        >
          {content}
        </Link>
      ) : (
        <div className={classes}>{content}</div>
      )}
    </li>
  );
}
function MoverBlock({
  title,
  rows,
  period,
}: {
  title: string;
  rows: MarketStatisticAsset[];
  period: MarketPeriod;
}) {
  return (
    <section className="card card-border min-w-0 bg-base-200">
      <header className="flex items-center justify-between gap-2 px-3 pt-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs text-base-content/55">გრაფიკი · 7დღ</span>
      </header>
      {rows.length ? (
        <ul className="list mt-1">
          {rows.map((asset) => (
            <AssetRow key={asset.id} asset={asset} period={period} />
          ))}
        </ul>
      ) : (
        <p className="px-3 py-4 text-xs text-base-content/60">
          ამ პერიოდში შესაბამისი აქტივი არ არის.
        </p>
      )}
    </section>
  );
}
function MarketTab({
  data,
  period,
}: {
  data: MarketStatistics;
  period: MarketPeriod;
}) {
  const overview = data.overview;
  const movers = topMovers(
    data.assets.filter((asset) => !data.stablecoinIds?.includes(asset.id)),
    3,
    period,
  );
  const breadth = marketBreadth(data.assets, period, data.stablecoinIds);
  const segments = [
    { label: "ზრდა", count: breadth.rising, color: "bg-success" },
    { label: "კლება", count: breadth.falling, color: "bg-error" },
    { label: "უცვლელი", count: breadth.unchanged, color: "bg-base-content/40" },
  ];
  return (
    <div className="space-y-3 lg:space-y-4">
      {overview ? (
        <section className="card card-border bg-base-200">
          <div className="grid grid-cols-2 lg:grid-cols-3">
            <Metric
              label="ბაზრის კაპიტალიზაცია"
              value={compactMoney(overview.totalMarketCap)}
            />
            <Metric
              label="24სთ მოცულობა"
              value={compactMoney(overview.volume24h)}
            />
            <Metric
              label="BTC დომინაცია"
              value={percentage(overview.btcDominance)}
            />
            <div className="flex flex-col justify-center gap-1 p-3 text-xs text-base-content/60 lg:col-span-3 lg:flex-row lg:justify-between lg:border-t lg:border-base-300">
              <span>
                ETH ·{" "}
                <b className="numeric text-base-content">
                  {percentage(overview.ethDominance)}
                </b>
              </span>
              <span>
                სტეიბლკოინები ·{" "}
                <b className="numeric text-base-content">
                  {compactMoney(overview.stablecoinMarketCap)}
                </b>
              </span>
              <span title={dateTime(overview.updatedAt)}>
                CoinGecko · {dateTime(overview.updatedAt, true)}
              </span>
            </div>
          </div>
        </section>
      ) : (
        <div
          role="alert"
          className="alert alert-warning alert-soft py-3 text-xs"
        >
          ბაზრის მონაცემები დროებით მიუწვდომელია.
        </div>
      )}
      {data.assets.length > 0 && (
        <>
          <section className="card card-border bg-base-200">
            <div className="card-body gap-3 p-3 sm:p-4">
              <header className="flex flex-wrap items-center justify-between gap-1">
                <h2 className="text-sm font-semibold">ბაზრის მიმართულება</h2>
                <span className="text-xs text-base-content/55">
                  ტოპ 100 · სტეიბლკოინების გარეშე
                </span>
              </header>
              <div
                className="flex h-2 overflow-hidden rounded-full bg-base-300"
                aria-hidden="true"
              >
                {segments
                  .filter((segment) => segment.count > 0)
                  .map((segment) => (
                    <span
                      key={segment.label}
                      className={segment.color}
                      style={{
                        width: `${(segment.count / Math.max(1, breadth.covered)) * 100}%`,
                      }}
                    />
                  ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {segments.map((segment) => (
                  <div
                    key={segment.label}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span
                      className={`size-2 shrink-0 rounded-full ${segment.color}`}
                    />
                    <span>
                      {segment.label}
                      <strong className="numeric ml-2">{segment.count}</strong>
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-base-content/55">
                დაფარვა: {breadth.covered}/{breadth.total} აქტივი
                {breadth.missing
                  ? ` · ${breadth.missing} ცვლილება მიუწვდომელია`
                  : ""}
              </p>
            </div>
          </section>
          <div className="grid gap-3 2xl:grid-cols-2">
            <MoverBlock
              title="ყველაზე დიდი ზრდა"
              rows={movers.gainers}
              period={period}
            />
            <MoverBlock
              title="ყველაზე დიდი კლება"
              rows={movers.losers}
              period={period}
            />
          </div>
        </>
      )}
    </div>
  );
}
function OwnedAssets({
  summary,
  assets,
  period,
  portfolioId,
}: {
  summary: PortfolioSummary;
  assets: MarketStatisticAsset[];
  period: MarketPeriod;
  portfolioId: string;
}) {
  const positions = summary.positions.filter(
    (position) => position.quantity !== "0",
  );
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  const covered = positions.filter((position) =>
    byId.has(position.asset.providerId),
  ).length;
  return (
    <section className="card card-border min-w-0 bg-base-200">
      <header className="flex flex-wrap items-center justify-between gap-2 p-3">
        <h2 className="text-sm font-semibold">ჩემი აქტივები ბაზარზე</h2>
        <span className="text-xs text-base-content/55">გრაფიკი · 7დღ</span>
      </header>
      {positions.length ? (
        <>
          <p className="px-3 pb-2 text-xs text-base-content/55">
            საბაზრო დაფარვა: {covered}/{positions.length}
            {summary.stale ? " · პორტფელის ფასები მოძველებულია" : ""}
          </p>
          <ul className="list">
            {positions.map((position) => {
              const asset = byId.get(position.asset.providerId) ?? {
                id: position.asset.providerId,
                symbol: position.asset.symbol,
                name: position.asset.name,
                image: position.asset.logoUrl ?? null,
                rank: null,
                price: position.quote?.price ?? null,
                change24h: position.quote?.stale
                  ? null
                  : (position.quote?.change24h ?? null),
                change1h: null,
                change7d: null,
                marketCap: null,
                volume24h: null,
                circulatingSupply: null,
                sparkline7d: [],
              };
              return (
                <AssetRow
                  key={position.assetId}
                  asset={asset}
                  period={period}
                  href={`/portfolios/${portfolioId}/positions/${position.assetId}`}
                />
              );
            })}
          </ul>
        </>
      ) : (
        <p className="px-3 pb-4 text-sm text-base-content/60">
          აქტიური პოზიცია არ არის.
        </p>
      )}
    </section>
  );
}
export function StatisticsWorkspace({
  market,
  macro,
  summary,
  portfolioId,
  ownedAssets = [],
}: {
  market: MarketStatistics | null;
  macro: MacroStatistics | null;
  summary: PortfolioSummary;
  portfolioId: string;
  ownedAssets?: MarketStatisticAsset[];
}) {
  const [tab, setTab] = useWorkspaceTab(
    ["market", "macro", "portfolio"],
    "portfolio",
  );
  const [period, setPeriod] = useState<MarketPeriod>("24h");
  return (
    <WorkspaceTabs
      label="სტატისტიკის კატეგორია"
      value={tab}
      onChange={setTab}
      items={[
        ["portfolio", "ჩემი პორტფელი"],
        ["market", "კრიპტო ბაზარი"],
        ["macro", "მაკრო"],
      ]}
    >
      <div className="space-y-3 lg:space-y-4">
        {tab === "market" && (
          <PeriodControl period={period} onChange={setPeriod} />
        )}
        {tab === "market" &&
          (market ? (
            <MarketTab data={market} period={period} />
          ) : (
            <p role="status" className="text-sm text-base-content/60">
              მონაცემები იტვირთება…
            </p>
          ))}
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
            <PortfolioStatistics summary={summary} portfolioId={portfolioId} />
            <details className="collapse collapse-arrow border border-base-300 bg-base-200">
              <summary className="collapse-title min-h-11 py-3 text-sm">
                აქტივების საბაზრო კონტექსტი
              </summary>
              <div className="collapse-content space-y-3">
                <PeriodControl period={period} onChange={setPeriod} />
                <OwnedAssets
                  summary={summary}
                  assets={ownedAssets}
                  period={period}
                  portfolioId={portfolioId}
                />
              </div>
            </details>
          </>
        )}
      </div>
    </WorkspaceTabs>
  );
}
