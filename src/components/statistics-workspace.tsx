"use client";
import Link from "next/link";
import { MacroIndicators } from "./macro-indicators";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Search } from "lucide-react";
import type { PortfolioSummary } from "@/domain/types";
import type {
  MacroStatistics,
  MarketStatisticAsset,
  MarketStatistics,
} from "@/domain/statistics";
import { topMovers } from "@/domain/statistics";
import { compactMoney, dateTime, money, percentage, pnlClass } from "@/lib/formatters";

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
      <polyline fill="none" stroke={up ? "#65d9ac" : "#ff8495"} strokeWidth="2" points={points} />
    </svg>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="panel min-w-0 p-5">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="numeric mt-2 truncate text-xl font-semibold">{value}</p>
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
    <div className="space-y-7">
      {overview ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
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
        <div className="overflow-x-auto">
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
                  <span className="flex size-7 items-center justify-center rounded-full bg-raised text-[9px] font-medium">{asset.symbol.slice(0, 2)}</span>
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
  return <div className="panel p-5"><h3 className="text-xs font-medium">{title}</h3><div className="mt-4 space-y-3">{rows.map((asset) => <div key={asset.id} className="flex items-center justify-between text-xs"><span>{asset.symbol} <span className="ml-2 text-muted">#{asset.rank}</span></span><span className={positive ? "text-positive" : "text-negative"}>{percentage(asset.change24h, true)}</span></div>)}</div></div>;
}

function MacroTab({ data }: { data: MacroStatistics }) {
  return <MacroIndicators data={data} />;
}

function PortfolioTab({ summary }: { summary: PortfolioSummary }) {
  const active = summary.positions.filter((position) => position.quantity !== "0");
  const btc = active.find((position) => position.asset.symbol === "BTC")?.allocation ?? "0";
  const eth = active.find((position) => position.asset.symbol === "ETH")?.allocation ?? "0";
  const stable = active.filter((position) => position.asset.isStablecoin).reduce((sum, position) => sum + Number(position.allocation ?? 0), 0);
  const reserve = Number(summary.value ?? 0) > 0 ? (Number(summary.cash) / Number(summary.value!)) * 100 : 0;
  const alt = Math.max(0, 100 - Number(btc) - Number(eth) - stable - reserve);
  return <div className="space-y-7"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><MetricCard label="პორტფელის ღირებულება" value={money(summary.value)} /><MetricCard label="BTC განაწილება" value={percentage(btc)} /><MetricCard label="ETH განაწილება" value={percentage(eth)} /><MetricCard label="სხვა კრიპტოაქტივები" value={percentage(String(alt))} /><MetricCard label="Stablecoin-ები" value={percentage(String(stable))} /><MetricCard label="ნაღდი რეზერვი" value={percentage(String(reserve))} /></div><div className="panel p-6"><h2 className="text-sm font-medium">ბაზრის კონტექსტი</h2><p className="mt-3 max-w-3xl text-xs leading-6 text-muted">აქ ნაჩვენებია თქვენი მიმდინარე განაწილება საბაზრო და მაკრო მონაცემების კონტექსტში. ეს ბლოკი მხოლოდ ფაქტობრივ მდგომარეობას აღწერს და საინვესტიციო რეკომენდაციას არ წარმოადგენს.</p></div></div>;
}

export function StatisticsWorkspace({ market, macro, summary, selectedAssetIds, base }: { market: MarketStatistics; macro: MacroStatistics; summary: PortfolioSummary; selectedAssetIds: string[]; base: string }) {
  const [tab, setTab] = useState<Tab>("market");
  const owned = new Map(summary.positions.filter((position) => position.quantity !== "0").map((position) => [position.asset.id, position.allocation]));
  return <div><div className="mb-7 flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1">{([ ["market", "კრიპტო ბაზარი"], ["macro", "მაკრო"], ["portfolio", "ჩემი პორტფელი"] ] as const).map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={`min-w-max rounded-lg px-5 py-3 text-xs transition ${tab === id ? "bg-brand text-[#181126]" : "text-muted hover:bg-raised hover:text-foreground"}`}>{label}</button>)}</div>{tab === "market" && <MarketTab data={market} owned={owned} selected={new Set(selectedAssetIds)} base={base} />}{tab === "macro" && <MacroTab data={macro} />}{tab === "portfolio" && <PortfolioTab summary={summary} />}</div>;
}
