"use client";
import { useState } from "react";
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
import { AssetIcon } from "./positions";

type Tab = "market" | "macro" | "portfolio";
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
    <div className="market-metric">
      <span className="flex size-9 items-center justify-center rounded-xl bg-raised text-brand">
        <BarChart3 size={17} />
      </span>
      <p className="mt-4 text-[11px] text-muted">{label}</p>
      <p className="numeric mt-1.5 whitespace-nowrap text-lg font-semibold tracking-[-.04em]">
        {value}
      </p>
      {hint && <p className="mt-2 truncate text-[10px] text-muted">{hint}</p>}
    </div>
  );
}

function MarketTab({ data }: { data: MarketStatistics }) {
  const movers = topMovers(data.assets);
  const overview = data.overview;
  return (
    <div className="statistics-workspace space-y-7">
      {overview ? (
        <>
          <div className="market-summary-strip">
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
          <p className="text-[10px] text-muted">
            წყარო: {overview.source} · განახლდა {dateTime(overview.updatedAt)}
          </p>
        </>
      ) : (
        <div className="card panel p-6 text-xs leading-6 text-muted">
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
    <div className={`market-movers ${positive ? "positive" : "negative"}`}>
      <h3>{title}</h3>
      <div>
        {rows.map((asset) => (
          <div key={asset.id}>
            <span className="market-mover-asset">
              <AssetIcon
                symbol={asset.symbol}
                logoUrl={asset.image}
                size={23}
              />
              <b>{asset.symbol}</b>
              <small>#{asset.rank}</small>
            </span>
            <i
              style={{
                width: `${Math.min(100, Math.max(8, Math.abs(Number(asset.change24h ?? 0))))}%`,
              }}
            />
            <strong>{percentage(asset.change24h, true)}</strong>
          </div>
        ))}
      </div>
    </div>
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
    <div className="portfolio-workspace">
      <header className="portfolio-commandbar">
        <div>
          <span>PORTFOLIO PULSE</span>
          <h2>ჩემი პორტფელი</h2>
        </div>
        <strong>{money(summary.value)}</strong>
      </header>
      <section className="portfolio-pulse">
        <div>
          <span>სრული P/L</span>
          <strong className={pnlClass(summary.totalPnl)}>
            {money(summary.totalPnl)}
          </strong>
          <small>რეალიზებული და მიმდინარე</small>
        </div>
        <div>
          <span>საერთო ლიკვიდობა</span>
          <strong>{money(summary.liquidity)}</strong>
          <small>პორტფელის {percentage(liquidity)}</small>
        </div>
        <div>
          <span>აქტიური პოზიციები</span>
          <strong>{active.length}</strong>
          <small>ფასიანი აქტივები</small>
        </div>
        <div>
          <span>ფასის სტატუსი</span>
          <strong>{summary.complete ? "სრული" : "ნაწილობრივი"}</strong>
          <small>
            {summary.stale ? "განახლება საჭიროა" : "ფასები აქტუალურია"}
          </small>
        </div>
      </section>
      <section className="portfolio-layout">
        <article className="portfolio-structure">
          <header>
            <h3>პორტფელის სტრუქტურა</h3>
            <span>ქეში და სტეიბლები — ლიკვიდობა</span>
          </header>
          <div className="portfolio-segments">
            {segments
              .filter((segment) => segment.value > 0)
              .map((segment) => (
                <span
                  key={segment.label}
                  style={{ flex: segment.value, background: segment.color }}
                  title={`${segment.label} ${percentage(String(segment.value))}`}
                />
              ))}
          </div>
          <div className="portfolio-breakdown">
            {segments.map((segment) => (
              <div key={segment.label}>
                <span>
                  <i style={{ background: segment.color }} />
                  {segment.label}
                </span>
                <strong>{percentage(String(segment.value))}</strong>
              </div>
            ))}
          </div>
        </article>
        <article className="portfolio-holdings">
          <header>
            <h3>უმსხვილესი პოზიციები</h3>
            <span>ღირებულებით</span>
          </header>
          {holdings.length ? (
            holdings.map((position) => (
              <div className="portfolio-holding" key={position.assetId}>
                <span>
                  {position.asset.symbol} · {position.asset.name}
                </span>
                <span>{percentage(position.allocation)}</span>
                <strong>{money(position.value)}</strong>
              </div>
            ))
          ) : (
            <div className="portfolio-holding">
              <span>აქტიური კრიპტო პოზიცია არ არის</span>
            </div>
          )}
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
  const [tab, setTab] = useState<Tab>("market");
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">ბაზრის მიმოხილვა</p>
          <p className="mt-1 text-xs text-muted">
            კრიპტო ბაზარი, მაკრო და თქვენი პორტფელი
          </p>
        </div>
        <div
          className="tabs tabs-box ccx-tabs overflow-x-auto"
          role="group"
          aria-label="სტატისტიკის კატეგორია"
        >
          {(
            [
              ["market", "კრიპტო ბაზარი"],
              ["macro", "მაკრო"],
              ["portfolio", "ჩემი პორტფელი"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={tab === id}
              onClick={() => setTab(id)}
              className="min-w-max"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {tab === "market" && <MarketTab data={market} />}
      {tab === "macro" && <MacroTab data={macro} />}
      {tab === "portfolio" && <PortfolioTab summary={summary} />}
    </div>
  );
}
