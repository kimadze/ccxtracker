"use client";
import { useState } from "react";
import { Grid2X2, List, NotebookPen, RotateCcw, Search, SlidersHorizontal, TrendingUp } from "lucide-react";
import Link from "next/link";
import type { Asset, ValuedPosition } from "@/domain/types";
import { decimal } from "@/domain/decimal";
import { money, percentage, pnlClass, quantity } from "@/lib/formatters";
import { AssetIcon, PositionsTable } from "./positions";
import { BalanceValue } from "./ui";
import { MobileBottomSheet } from "./mobile-components";
import { PositionShare } from "./position-share";
import { TransactionForm } from "./transaction-form";
export function PositionsWorkspace({
  positions,
  base,
  assets,
  revision,
  preview = false,
}: {
  positions: ValuedPosition[];
  base: string;
  assets: Asset[];
  revision: number;
  preview?: boolean;
}) {
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [sort, setSort] = useState("value"),
    [view, setView] = useState<"table" | "cards">("table"),
    [selectedAssetId, setSelectedAssetId] = useState(positions[0]?.assetId ?? ""),
    [page, setPage] = useState(0);
  const filtered = positions
    .filter(
      (p) =>
        `${p.asset.name} ${p.asset.symbol}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (filter === "all" ||
          (filter === "unpriced" ? p.value === null : p.unrealizedPnl !== null &&
            (filter === "profit"
              ? decimal(p.unrealizedPnl).gt(0)
              : decimal(p.unrealizedPnl).lt(0)))),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.asset.name.localeCompare(b.asset.name)
        : decimal(
            sort === "return" ? (b.returnPercent ?? 0) : (b.value ?? 0),
          ).cmp(sort === "return" ? (a.returnPercent ?? 0) : (a.value ?? 0)),
    );
  const pages = Math.max(1, Math.ceil(filtered.length / 20)),
    current = Math.min(page, pages - 1);
  const profitable = positions.filter((position) => position.unrealizedPnl !== null && decimal(position.unrealizedPnl).gt(0)).length;
  const losing = positions.filter((position) => position.unrealizedPnl !== null && decimal(position.unrealizedPnl).lt(0)).length;
  const unpriced = positions.filter((position) => position.value === null).length;
  const reset = () => { setSearch(""); setFilter("all"); setSort("value"); setPage(0); };
  const selected = filtered.find((position) => position.assetId === selectedAssetId) ?? filtered[0] ?? positions[0];
  return (
    <div className="space-y-4">
      <section className="tabs tabs-box w-full overflow-x-auto bg-base-200" role="tablist" aria-label="პოზიციების ფილტრები">
        <button role="tab" type="button" className={`tab gap-2 ${filter === "all" ? "tab-active" : ""}`} onClick={() => { setFilter("all"); setPage(0); }}>ყველა <span className="badge badge-sm">{positions.length}</span></button>
        <button role="tab" type="button" className={`tab gap-2 ${filter === "profit" ? "tab-active" : ""}`} onClick={() => { setFilter("profit"); setPage(0); }}>მოგებაში <span className="badge badge-success badge-sm">{profitable}</span></button>
        <button role="tab" type="button" className={`tab gap-2 ${filter === "loss" ? "tab-active" : ""}`} onClick={() => { setFilter("loss"); setPage(0); }}>ზარალში <span className="badge badge-error badge-sm">{losing}</span></button>
        <button role="tab" type="button" className={`tab gap-2 ${filter === "unpriced" ? "tab-active" : ""}`} onClick={() => { setFilter("unpriced"); setPage(0); }}>ფასის გარეშე <span className="badge badge-warning badge-sm">{unpriced}</span></button>
      </section>
      <div className="card border border-base-300 bg-base-200"><div className="card-body flex-row flex-wrap gap-3 p-4">
        <label className="input min-w-64 flex-1">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">პოზიციების ძიება</span>
          <input
          aria-label="პოზიციების ძიება"
          placeholder="მოძებნეთ აქტივი ან სიმბოლო"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          />
        </label>
        <label className="input hidden md:flex"><SlidersHorizontal size={15} aria-hidden="true" /><select
          aria-label="შედეგის ფილტრი"
          className="grow"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(0);
          }}
        >
          <option value="all">ყველა პოზიცია</option>
          <option value="profit">მოგებით</option>
          <option value="loss">ზარალით</option>
          <option value="unpriced">ფასის გარეშე</option>
        </select></label>
        <select className="select hidden max-w-48 md:block"
          aria-label="პოზიციების დალაგება"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="value">ღირებულებით</option>
          <option value="return">შემოსავლიანობით</option>
          <option value="name">სახელით</option>
        </select>
        <div className="join hidden md:flex" role="group" aria-label="პოზიციების ხედი">
          <button type="button" className={`btn btn-square join-item ${view === "table" ? "btn-active" : ""}`} onClick={() => setView("table")} aria-label="ცხრილის ხედი"><List size={16} /></button>
          <button type="button" className={`btn btn-square join-item ${view === "cards" ? "btn-active" : ""}`} onClick={() => setView("cards")} aria-label="ბარათების ხედი"><Grid2X2 size={16} /></button>
        </div>
        <div className="mobile-position-filter">
          <MobileBottomSheet title="პოზიციების ფილტრი" trigger={<button type="button" className="btn btn-ghost button-secondary"><SlidersHorizontal size={16} /> ფილტრი</button>}>
            <div className="mobile-filter-options" role="group" aria-label="შედეგის ფილტრი">
              {[["all", "ყველა", positions.length], ["profit", "მოგებაში", profitable], ["loss", "ზარალში", losing], ["unpriced", "ფასის გარეშე", unpriced]].map(([value, label, count]) => <button key={String(value)} type="button" className={filter === value ? "active" : ""} onClick={() => { setFilter(String(value)); setPage(0); }}><span>{String(label)}</span><strong>{String(count)}</strong></button>)}
            </div>
            <label className="mobile-filter-select"><span>დალაგება</span><select className="select select-bordered" value={sort} onChange={(event) => setSort(event.target.value)}><option value="value">ღირებულებით</option><option value="return">შემოსავლიანობით</option><option value="name">სახელით</option></select></label>
            {(search || filter !== "all" || sort !== "value") && <button type="button" className="btn btn-ghost button-secondary w-full" onClick={reset}><RotateCcw size={15} /> ფილტრების გასუფთავება</button>}
          </MobileBottomSheet>
        </div>
        {(search || filter !== "all" || sort !== "value") && <button type="button" className="btn hidden md:inline-flex" onClick={reset}><RotateCcw size={14} /> გასუფთავება</button>}
      </div></div>
      <div className="flex items-center gap-3 text-sm text-base-content/55"><span><strong className="text-base-content">{filtered.length}</strong> შედეგი</span>{search && <span>ძიება: “{search}”</span>}</div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0">
          <PositionsTable
            positions={filtered.slice(current * 20, current * 20 + 20)}
            base={base}
            preview={preview}
            view={view === "cards" ? "cards" : "auto"}
            selectedAssetId={selected?.assetId}
            onSelect={setSelectedAssetId}
          />
        </section>
        {selected && <PositionBrief position={selected} base={base} assets={assets} revision={revision} preview={preview} />}
      </div>
      {filtered.length > 20 && (
        <div className="flex items-center justify-end gap-3">
          <button
            className="btn btn-ghost button-secondary"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            წინა
          </button>
          <span className="text-sm text-base-content/55">
            {current + 1} / {pages}
          </span>
          <button
            className="btn btn-ghost button-secondary"
            disabled={current + 1 >= pages}
            onClick={() => setPage(current + 1)}
          >
            შემდეგი
          </button>
        </div>
      )}
    </div>
  );
}

function PositionBrief({ position, base, assets, revision, preview }: { position: ValuedPosition; base: string; assets: Asset[]; revision: number; preview: boolean }) {
  const positive = position.unrealizedPnl !== null && decimal(position.unrealizedPnl).gt(0);
  return <aside className="card h-fit border border-base-300 bg-base-200 xl:sticky xl:top-24" aria-label={`${position.asset.symbol} პოზიციის მოკლე ინფორმაცია`}><div className="card-body p-5">
    <header className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><AssetIcon symbol={position.asset.symbol} logoUrl={position.asset.logoUrl} size={44} /><div><h2 className="text-lg font-semibold">{position.asset.symbol}</h2><span className="text-sm text-base-content/50">{position.asset.name}</span></div></div>{!preview && <PositionShare position={position} compact />}</header>
    <div className="mt-3"><span className="text-sm text-base-content/55">მიმდინარე ფასი</span><strong className="mt-1 block text-3xl">{money(position.quote?.price ?? null)}</strong><span className={`mt-1 block text-sm ${pnlClass(position.quote?.change24h ?? null)}`}>{percentage(position.quote?.change24h ?? null, true)} · 24სთ</span></div>
    <div className="stats stats-vertical border border-base-300 bg-base-100"><div className="stat py-3"><div className="stat-title">რაოდენობა</div><div className="stat-value text-base">{quantity(position.quantity)}</div></div><div className="stat py-3"><div className="stat-title">საშ. შესყიდვა</div><div className="stat-value text-base">{money(position.averagePrice)}</div></div><div className="stat py-3"><div className="stat-title">ღირებულება</div><div className="stat-value text-base"><BalanceValue>{money(position.value)}</BalanceValue></div></div><div className="stat py-3"><div className="stat-title">პორტფელის წილი</div><div className="stat-value text-base">{percentage(position.allocation)}</div></div></div>
    <div className={`alert alert-soft ${positive ? "alert-success" : "alert-error"}`}><div><span className="text-xs opacity-70">არარეალიზებული P/L</span><strong className="block text-xl"><BalanceValue>{position.unrealizedPnl && positive ? "+" : ""}{money(position.unrealizedPnl)}</BalanceValue></strong></div><b className="ml-auto">{percentage(position.returnPercent, true)}</b></div>
    {!preview && <>
      <div className="card-actions grid grid-cols-2"><TransactionForm portfolioId={base.split("/").at(-1) ?? ""} revision={revision} assets={assets} initialAsset={position.assetId} triggerLabel="ტრანზაქცია" /><Link className="btn" href={`${base}/positions/${position.assetId}`}>მართვა</Link></div>
      <div className="grid grid-cols-2 gap-2" aria-label={`${position.asset.symbol} დაგეგმვის მოქმედებები`}>
        <Link className="btn btn-ghost btn-sm" href={`${base}/positions/${position.assetId}?tab=exit`}><TrendingUp size={14} /><span>გასვლის გეგმა</span></Link>
        <Link className="btn btn-ghost btn-sm" href={`${base}/positions/${position.assetId}?tab=journal`}><NotebookPen size={14} /><span>ჟურნალი</span></Link>
      </div>
    </>}
  </div></aside>;
}
