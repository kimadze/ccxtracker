"use client";
import { WorkspaceTabs, useWorkspaceTab } from "./workspace-tabs";
import { MacroIndicators } from "./macro-indicators";
import { BarChart3 } from "lucide-react";
import type { PortfolioSummary } from "@/domain/types";
import type {
  MacroStatistics,
  MarketStatisticAsset,
  MarketStatistics,
} from "@/domain/statistics";
import { topMovers } from "@/domain/statistics";
import { percent } from "@/domain/decimal";
import {
  compactMoney,
  dateTime,
  money,
  percentage,
  pnlClass,
} from "@/lib/formatters";
import { BalanceValue } from "./ui";
import { AssetIcon } from "./positions";

function compact(value: string | null) {
  return compactMoney(value);
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="stat min-w-0">
      <span className="stat-figure text-primary">
        <BarChart3 size={17} />
      </span>
      <p className="stat-title whitespace-normal text-xs">{label}</p>
      <p className="stat-value numeric mt-1.5 whitespace-nowrap text-xl tracking-[-.04em]">
        {value}
      </p>
      {hint && <p className="stat-desc mt-2 truncate text-xs">{hint}</p>}
    </div>
  );
}

function MarketTab({ data }: { data: MarketStatistics }) {
  const movers = topMovers(data.assets);
  const overview = data.overview;
  return (
    <div className="space-y-3 lg:space-y-4">
      {overview ? (
        <>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-box border border-base-300 bg-base-200 lg:grid-cols-3">
            <MetricCard
              label="კრიპტო ბაზრის კაპიტალიზაცია"
              value={compact(overview.totalMarketCap)}
            />
            <MetricCard
              label="24სთ მოცულობა"
              value={compact(overview.volume24h)}
            />
            <MetricCard
              label="BTC დომინაცია"
              value={percentage(overview.btcDominance)}
            />
            <MetricCard
              label="ETH დომინაცია"
              value={percentage(overview.ethDominance)}
            />
            <MetricCard
              label="Stablecoin კაპიტალიზაცია"
              value={compact(overview.stablecoinMarketCap)}
            />
          </div>
          <p className="text-xs text-base-content/60">
            წყარო: {overview.source} · განახლდა {dateTime(overview.updatedAt)}
          </p>
        </>
      ) : (
        <div
          role="alert"
          className="alert alert-warning alert-soft text-xs leading-6"
        >
          ბაზრის მონაცემები ამჟამად მიუწვდომელია. შეამოწმეთ CoinGecko API-ის
          კონფიგურაცია.
        </div>
      )}
      {!!data.assets.length && (
        <div className="grid gap-4 lg:grid-cols-2">
          <MoverBlock
            title="ტოპ ზრდა · ტოპ 100"
            rows={movers.gainers}
            positive
          />
          <MoverBlock title="ტოპ კლება · ტოპ 100" rows={movers.losers} />
        </div>
      )}
    </div>
  );
}
function MacroTab({ data }: { data: MacroStatistics }) {
  return <MacroIndicators data={data} />;
}

function MoverBlock({
  title,
  rows,
  positive = false,
}: {
  title: string;
  rows: MarketStatisticAsset[];
  positive?: boolean;
}) {
  return (
    <section
      className={`card card-border bg-base-200 ${positive ? "border-success/30" : "border-error/30"}`}
    >
      <div className="card-body p-4">
        <h3 className="card-title text-base">{title}</h3>
        <ul className="list">
          {rows.map((asset) => (
            <li
              className="list-row items-center border-b border-base-300 px-0 last:border-0"
              key={asset.id}
            >
              <span className="flex items-center gap-2">
                <AssetIcon
                  symbol={asset.symbol}
                  logoUrl={asset.image}
                  size={23}
                />
                <b>{asset.symbol}</b>
                <small>#{asset.rank}</small>
              </span>
              <progress
                className={`progress w-full ${positive ? "progress-success" : "progress-error"}`}
                value={Math.min(
                  100,
                  Math.max(8, Math.abs(Number(asset.change24h ?? 0))),
                )}
                max="100"
              />
              <strong className={positive ? "text-success" : "text-error"}>
                {percentage(asset.change24h, true)}
              </strong>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function PortfolioTab({ summary }: { summary: PortfolioSummary }) {
  const active = summary.positions.filter(
    (position) => position.quantity !== "0",
  );
  const btc =
    active.find((position) => position.asset.symbol === "BTC")?.allocation ??
    "0";
  const eth =
    active.find((position) => position.asset.symbol === "ETH")?.allocation ??
    "0";
  const stable =
    summary.value && summary.stablecoinValue !== null
      ? Number(percent(summary.stablecoinValue, summary.value) ?? 0)
      : 0;
  const cash = summary.value
    ? Number(percent(summary.cash, summary.value) ?? 0)
    : 0;
  const liquidity =
    summary.value && summary.liquidity !== null
      ? percent(summary.liquidity, summary.value)
      : null;
  const alt = Math.max(0, 100 - Number(btc) - Number(eth) - stable - cash);
  const holdings = active
    .filter((position) => !position.asset.isStablecoin)
    .sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0))
    .slice(0, 5);
  const segments = [
    { label: "BTC", value: Number(btc), color: "#8a63ee" },
    { label: "ETH", value: Number(eth), color: "#3e8cff" },
    { label: "სხვა კრიპტო", value: alt, color: "#29cbb6" },
    { label: "სტეიბლკოინები", value: stable, color: "#f5ba57" },
    { label: "ნაღდი ფული", value: cash, color: "#8c96aa" },
  ];
  return (
    <div className="space-y-3 lg:space-y-4">
      <header className="card card-border bg-base-200">
        <div className="card-body gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-medium text-base-content/60">
              პორტფელის ღირებულება
            </h2>
          </div>
          <strong className="numeric text-2xl">
            <BalanceValue>{money(summary.value)}</BalanceValue>
          </strong>
        </div>
      </header>
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-box border border-base-300 bg-base-200 lg:grid-cols-4">
        <div className="stat">
          <span className="stat-title">სრული P/L</span>
          <strong
            className={`stat-value text-xl ${pnlClass(summary.totalPnl)}`}
          >
            <BalanceValue>{money(summary.totalPnl)}</BalanceValue>
          </strong>
          <small className="stat-desc">რეალიზებული და მიმდინარე</small>
        </div>
        <div className="stat">
          <span className="stat-title">საერთო ლიკვიდობა</span>
          <strong className="stat-value text-xl">
            <BalanceValue>{money(summary.liquidity)}</BalanceValue>
          </strong>
          <small className="stat-desc">პორტფელის {percentage(liquidity)}</small>
        </div>
        <div className="stat">
          <span className="stat-title">აქტიური პოზიციები</span>
          <strong className="stat-value text-xl">{active.length}</strong>
          <small className="stat-desc">ფასიანი აქტივები</small>
        </div>
        <div className="stat">
          <span className="stat-title">ფასის სტატუსი</span>
          <strong className="stat-value text-xl">
            {summary.complete ? "სრული" : "ნაწილობრივი"}
          </strong>
          <small className="stat-desc">
            {summary.stale ? "განახლება საჭიროა" : "ფასები აქტუალურია"}
          </small>
        </div>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <article className="card card-border bg-base-200">
          <div className="card-body min-w-0 gap-3 p-4">
            <header>
              <h3 className="card-title text-base">პორტფელის სტრუქტურა</h3>
              <span className="text-xs text-base-content/60">
                ქეში და სტეიბლები — ლიკვიდობა
              </span>
            </header>
            <div
              className="flex h-3 overflow-hidden rounded-full bg-base-300"
              aria-hidden={!summary.complete}
            >
              {segments
                .filter(
                  (segment) =>
                    summary.complete &&
                    summary.value !== null &&
                    segment.value > 0,
                )
                .map((segment) => (
                  <span
                    key={segment.label}
                    style={{ flex: segment.value, background: segment.color }}
                    title={`${segment.label} ${percentage(String(segment.value))}`}
                  />
                ))}
            </div>
            <div className="space-y-2 text-sm [&>div]:flex [&>div]:justify-between [&_i]:mr-2 [&_i]:inline-block [&_i]:size-2 [&_i]:rounded-full">
              {segments.map((segment) => (
                <div key={segment.label}>
                  <span>
                    <i style={{ background: segment.color }} />
                    {segment.label}
                  </span>
                  <strong>
                    {summary.complete && summary.value !== null
                      ? percentage(String(segment.value))
                      : "—"}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        </article>
        <article className="card card-border bg-base-200">
          <div className="card-body min-w-0 gap-3 p-4">
            <header>
              <h3 className="card-title text-base">უმსხვილესი პოზიციები</h3>
              <span className="text-xs text-base-content/60">ღირებულებით</span>
            </header>
            {holdings.length ? (
              holdings.map((position) => (
                <div
                  className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-base-300 py-3 last:border-0"
                  key={position.assetId}
                >
                  <span>
                    {position.asset.symbol} · {position.asset.name}
                  </span>
                  <span>{percentage(position.allocation)}</span>
                  <strong>
                    <BalanceValue>{money(position.value)}</BalanceValue>
                  </strong>
                </div>
              ))
            ) : (
              <div className="alert alert-info alert-soft">
                <span>აქტიური კრიპტო პოზიცია არ არის</span>
              </div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}

export function StatisticsWorkspace({
  market,
  macro,
  summary,
}: {
  market: MarketStatistics;
  macro: MacroStatistics;
  summary: PortfolioSummary;
}) {
  const [tab, setTab] = useWorkspaceTab(
    ["market", "macro", "portfolio"],
    "market",
  );
  return (
    <WorkspaceTabs
      label="სტატისტიკის კატეგორია"
      value={tab}
      onChange={setTab}
      items={[
        ["market", "კრიპტო ბაზარი"],
        ["macro", "მაკრო"],
        ["portfolio", "ჩემი პორტფელი"],
      ]}
    >
      {tab === "market" && <MarketTab data={market} />}
      {tab === "macro" && <MacroTab data={macro} />}
      {tab === "portfolio" && <PortfolioTab summary={summary} />}
    </WorkspaceTabs>
  );
}
