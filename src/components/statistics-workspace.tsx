"use client";
import Link from "next/link";
import { MacroIndicators } from "./macro-indicators";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, BarChart3, ExternalLink, Search } from "lucide-react";
import type { PortfolioSummary } from "@/domain/types";
import type {
  MacroStatistics,
  MarketStatisticAsset,
  MarketStatistics,
} from "@/domain/statistics";
import { topMovers } from "@/domain/statistics";
import { percent } from "@/domain/decimal";
import { compactMoney, dateTime, money, percentage, pnlClass } from "@/lib/formatters";
import { AssetIcon } from "./positions";

type Tab = "market" | "macro" | "portfolio";
type SortKey = "rank" | "marketCap" | "price" | "change1h" | "change24h" | "change7d" | "volume24h";

function compact(value: string | null) {
  return compactMoney(value);
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="text-muted">—</span>;
  const sampled = values.filter((_, index) => index % Math.max(1, Math.floor(values.length / 30)) === 0);
  const min = Math.min(...sampled), max = Math.max(...sampled), range = max - min || 1;
  const points = sampled
    .map((value, index) => `${(index / (sampled.length - 1)) * 92},${30 - ((value - min) / range) * 26}`)
    .join(" ");
  const up = sampled[sampled.length - 1] >= sampled[0];
  return (
    <svg viewBox="0 0 92 34" className="h-8 w-24" role="img" aria-label="7 დღის ფასის გრაფიკი">
      <polyline fill="none" stroke={up ? "var(--positive)" : "var(--negative)"} strokeWidth="2" points={points} />
    </svg>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="market-metric">
      <span className="flex size-9 items-center justify-center rounded-xl bg-raised text-brand"><BarChart3 size={17}/></span>
      <p className="mt-4 text-[11px] text-muted">{label}</p>
      <p className="numeric mt-1.5 whitespace-nowrap text-lg font-semibold tracking-[-.04em]">{value}</p>
      {hint && <p className="mt-2 truncate text-[10px] text-muted">{hint}</p>}
    </div>
  );
}

function MarketTab({ data, owned, selected, base }: {
  data: MarketStatistics;
  owned: Map<string, string | null>;
  selected: Set<string>;
  base: string;
}) {
  const [query, setQuery] = useState(""), [sort, setSort] = useState<SortKey>("rank"), [direction, setDirection] = useState<"asc" | "desc">("asc");
  const rows = useMemo(() => {
    const result = data.assets.filter((asset) =>
      `${asset.name} ${asset.symbol}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
    );
    return result.sort((a, b) => {
      const av = a[sort] ?? (direction === "asc" ? Number.MAX_VALUE : Number.MIN_VALUE);
      const bv = b[sort] ?? (direction === "asc" ? Number.MAX_VALUE : Number.MIN_VALUE);
      return (Number(av) - Number(bv)) * (direction === "asc" ? 1 : -1);
    });
  }, [data.assets, query, sort, direction]);
  const movers = topMovers(data.assets);
  const overview = data.overview;
  return (
    <div className="statistics-workspace space-y-7">
      {overview ? (
        <>
          <div className="market-summary-strip">
            <MetricCard label="კრიპტო ბაზრის კაპიტალიზაცია" value={compact(overview.totalMarketCap)} />
            <MetricCard label="24სთ მოცულობა" value={compact(overview.volume24h)} />
            <MetricCard label="BTC დომინაცია" value={percentage(overview.btcDominance)} />
            <MetricCard label="ETH დომინაცია" value={percentage(overview.ethDominance)} />
            <MetricCard label="Stablecoin კაპიტალიზაცია" value={compact(overview.stablecoinMarketCap)} />
          </div>
          <p className="text-[10px] text-muted">წყარო: {overview.source} · განახლდა {dateTime(overview.updatedAt)}</p>
        </>
      ) : (
        <div className="panel p-6 text-xs leading-6 text-muted">ბაზრის მონაცემები ამჟამად მიუწვდომელია. შეამოწმეთ CoinGecko API-ის კონფიგურაცია.</div>
      )}
      {!!data.assets.length && (
        <div className="grid gap-4 lg:grid-cols-2">
          <MoverBlock title="ტოპ ზრდა · ტოპ 100" rows={movers.gainers} positive />
          <MoverBlock title="ტოპ კლება · ტოპ 100" rows={movers.losers} />
        </div>
      )}
      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line p-5">
          <div>
            <h2 className="text-sm font-medium">ტოპ 100 აქტივი</h2>
            <p className="mt-1 text-[10px] text-muted">რანჟირება საბაზრო კაპიტალიზაციით</p>
          </div>
          <label className="relative w-full sm:w-64">
            <span className="sr-only">მონეტის ძებნა</span>
            <Search className="absolute left-3 top-3.5 text-muted" size={15} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="BTC ან Bitcoin" className="pl-9" />
          </label>
        </div>
        <div className="desktop-market-table overflow-x-auto">
          <table className="w-full min-w-[930px] text-xs">
            <thead><tr>
              <th className="table-head text-left">აქტივი</th>
              <Sortable label="ფასი" value="price" current={sort} direction={direction} set={(value) => changeSort(value, sort, direction, setSort, setDirection)} />
              <Sortable label="1სთ" value="change1h" current={sort} direction={direction} set={(value) => changeSort(value, sort, direction, setSort, setDirection)} />
              <Sortable label="24სთ" value="change24h" current={sort} direction={direction} set={(value) => changeSort(value, sort, direction, setSort, setDirection)} />
              <Sortable label="7დღ" value="change7d" current={sort} direction={direction} set={(value) => changeSort(value, sort, direction, setSort, setDirection)} />
              <Sortable label="Market Cap" value="marketCap" current={sort} direction={direction} set={(value) => changeSort(value, sort, direction, setSort, setDirection)} />
              <Sortable label="24სთ მოცულობა" value="volume24h" current={sort} direction={direction} set={(value) => changeSort(value, sort, direction, setSort, setDirection)} />
              <th className="table-head">7 დღე</th>
            </tr></thead>
            <tbody>{rows.map((asset) => {
              const allocation = owned.get(asset.id);
              return <tr key={asset.id} className="hover:bg-raised/40">
                <td className="table-cell text-left"><div className="flex items-center gap-3">
                  <span className="w-6 text-right text-[10px] text-muted">{asset.rank ?? "—"}</span>
                  <AssetIcon symbol={asset.symbol} logoUrl={asset.image} size={28} />
                  <div><p className="font-medium">{asset.name} <span className="ml-1 text-muted">{asset.symbol}</span></p>
                  <p className="mt-1 text-[10px] text-brand">{allocation !== undefined ? `პორტფელშია${allocation ? ` · ${percentage(allocation)}` : ""}` : selected.has(asset.id) ? "დაკვირვების სიაშია" : ""}</p></div>
                </div></td>
                <td className="table-cell numeric">{money(asset.price)}</td>
                <Change value={asset.change1h} />
                <Change value={asset.change24h} />
                <Change value={asset.change7d} />
                <td className="table-cell numeric">{compact(asset.marketCap)}</td>
                <td className="table-cell numeric">{compact(asset.volume24h)}</td>
                <td className="table-cell"><Sparkline values={asset.sparkline7d} /></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        <div className="mobile-market-list">
          {rows.map((asset) => {
            const allocation = owned.get(asset.id);
            return <article key={asset.id} className="mobile-market-card">
              <div className="mobile-market-primary"><span className="mobile-market-rank">#{asset.rank ?? "—"}</span><AssetIcon symbol={asset.symbol} logoUrl={asset.image} size={32} /><div><strong>{asset.symbol}</strong><small>{asset.name}</small></div><div className="mobile-market-price"><strong className="numeric">{money(asset.price)}</strong><small className={pnlClass(asset.change24h)}>{percentage(asset.change24h, true)} · 24სთ</small></div></div>
              <div className="mobile-market-details"><span><small>1სთ</small><strong className={pnlClass(asset.change1h)}>{percentage(asset.change1h, true)}</strong></span><span><small>7დღ</small><strong className={pnlClass(asset.change7d)}>{percentage(asset.change7d, true)}</strong></span><span><small>Market cap</small><strong>{compact(asset.marketCap)}</strong></span><Sparkline values={asset.sparkline7d} /></div>
              {(allocation !== undefined || selected.has(asset.id)) && <p className="mobile-market-context">{allocation !== undefined ? `პორტფელშია${allocation ? ` · ${percentage(allocation)}` : ""}` : "დაკვირვების სიაშია"}</p>}
            </article>;
          })}
        </div>
        {!rows.length && <p className="p-12 text-center text-xs text-muted">შესაბამისი მონეტა ვერ მოიძებნა.</p>}
        <div className="border-t border-line p-4 text-right"><Link href={`${base}/watchlist`} className="text-xs text-brand">დაკვირვების სიის მართვა <ExternalLink className="inline" size={13} /></Link></div>
      </section>
    </div>
  );
}

function changeSort(value: SortKey, current: SortKey, direction: "asc" | "desc", setSort: (v: SortKey) => void, setDirection: (v: "asc" | "desc") => void) {
  if (value === current) setDirection(direction === "asc" ? "desc" : "asc");
  else { setSort(value); setDirection(value === "rank" ? "asc" : "desc"); }
}
function Sortable({ label, value, current, direction, set }: { label: string; value: SortKey; current: SortKey; direction: string; set: (value: SortKey) => void }) {
  return <th className="table-head"><button onClick={() => set(value)} className="inline-flex items-center gap-1">{label}{current === value && (direction === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}</button></th>;
}
function Change({ value }: { value: string | null }) { return <td className={`table-cell numeric ${pnlClass(value)}`}>{percentage(value, true)}</td>; }
function MoverBlock({ title, rows, positive = false }: { title: string; rows: MarketStatisticAsset[]; positive?: boolean }) {
  return <div className={`market-movers ${positive ? "positive" : "negative"}`}><h3>{title}</h3><div>{rows.map((asset) => <div key={asset.id}><span className="market-mover-asset"><AssetIcon symbol={asset.symbol} logoUrl={asset.image} size={23} /><b>{asset.symbol}</b><small>#{asset.rank}</small></span><i style={{ width: `${Math.min(100, Math.max(8, Math.abs(Number(asset.change24h ?? 0))))}%` }} /><strong>{percentage(asset.change24h, true)}</strong></div>)}</div></div>;
}

function MacroTab({ data }: { data: MacroStatistics }) {
  return <MacroIndicators data={data} />;
}

function PortfolioTab({ summary }: { summary: PortfolioSummary }) {
  const active = summary.positions.filter((position) => position.quantity !== "0");
  const btc = active.find((position) => position.asset.symbol === "BTC")?.allocation ?? "0";
  const eth = active.find((position) => position.asset.symbol === "ETH")?.allocation ?? "0";
  const stable = summary.value && summary.stablecoinValue !== null ? Number(percent(summary.stablecoinValue, summary.value) ?? 0) : 0;
  const cash = summary.value ? Number(percent(summary.cash, summary.value) ?? 0) : 0;
  const liquidity = summary.value && summary.liquidity !== null ? percent(summary.liquidity, summary.value) : null;
  const alt = Math.max(0, 100 - Number(btc) - Number(eth) - stable - cash);
  const holdings = active.filter((position) => !position.asset.isStablecoin).sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0)).slice(0, 5);
  const segments = [
    { label: "BTC", value: Number(btc), color: "#8a63ee" },
    { label: "ETH", value: Number(eth), color: "#3e8cff" },
    { label: "სხვა კრიპტო", value: alt, color: "#29cbb6" },
    { label: "სტეიბლკოინები", value: stable, color: "#f5ba57" },
    { label: "ნაღდი ფული", value: cash, color: "#8c96aa" },
  ];
  return <div className="portfolio-workspace">
    <header className="portfolio-commandbar"><div><span>PORTFOLIO PULSE</span><h2>ჩემი პორტფელი</h2></div><strong>{money(summary.value)}</strong></header>
    <section className="portfolio-pulse">
      <div><span>სრული P/L</span><strong className={pnlClass(summary.totalPnl)}>{money(summary.totalPnl)}</strong><small>რეალიზებული და მიმდინარე</small></div>
      <div><span>საერთო ლიკვიდობა</span><strong>{money(summary.liquidity)}</strong><small>პორტფელის {percentage(liquidity)}</small></div>
      <div><span>აქტიური პოზიციები</span><strong>{active.length}</strong><small>ფასიანი აქტივები</small></div>
      <div><span>ფასის სტატუსი</span><strong>{summary.complete ? "სრული" : "ნაწილობრივი"}</strong><small>{summary.stale ? "განახლება საჭიროა" : "ფასები აქტუალურია"}</small></div>
    </section>
    <section className="portfolio-layout">
      <article className="portfolio-structure"><header><h3>პორტფელის სტრუქტურა</h3><span>ქეში და სტეიბლები — ლიკვიდობა</span></header>
        <div className="portfolio-segments">{segments.filter((segment) => segment.value > 0).map((segment) => <span key={segment.label} style={{ flex: segment.value, background: segment.color }} title={`${segment.label} ${percentage(String(segment.value))}`} />)}</div>
        <div className="portfolio-breakdown">{segments.map((segment) => <div key={segment.label}><span><i style={{ background: segment.color }} />{segment.label}</span><strong>{percentage(String(segment.value))}</strong></div>)}</div>
      </article>
      <article className="portfolio-holdings"><header><h3>უმსხვილესი პოზიციები</h3><span>ღირებულებით</span></header>{holdings.length ? holdings.map((position) => <div className="portfolio-holding" key={position.assetId}><span>{position.asset.symbol} · {position.asset.name}</span><span>{percentage(position.allocation)}</span><strong>{money(position.value)}</strong></div>) : <div className="portfolio-holding"><span>აქტიური კრიპტო პოზიცია არ არის</span></div>}</article>
    </section>
  </div>;
}

export function StatisticsWorkspace({ market, macro, summary, selectedAssetIds, base }: { market: MarketStatistics; macro: MacroStatistics; summary: PortfolioSummary; selectedAssetIds: string[]; base: string }) {
  const [tab, setTab] = useState<Tab>("market");
  const owned = new Map(summary.positions.filter((position) => position.quantity !== "0").map((position) => [position.asset.id, position.allocation]));
  return <div>
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div><p className="text-sm font-semibold">ბაზრის მიმოხილვა</p><p className="mt-1 text-xs text-muted">კრიპტო ბაზარი, მაკრო და თქვენი პორტფელი</p></div>
      <div className="ccx-tabs overflow-x-auto" role="group" aria-label="სტატისტიკის კატეგორია">
        {([["market", "კრიპტო ბაზარი"], ["macro", "მაკრო"], ["portfolio", "ჩემი პორტფელი"]] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)} className="min-w-max">{label}</button>)}
      </div>
    </div>
    {tab === "market" && <MarketTab data={market} owned={owned} selected={new Set(selectedAssetIds)} base={base} />}
    {tab === "macro" && <MacroTab data={macro} />}
    {tab === "portfolio" && <PortfolioTab summary={summary} />}
  </div>;
}
