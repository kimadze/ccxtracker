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
    <div className="positions-workspace space-y-4">
      <section className="position-summary" aria-label="პოზიციების ფილტრები">
        <button type="button" className={filter === "all" ? "active" : ""} onClick={() => { setFilter("all"); setPage(0); }}><span>ყველა</span><strong>{positions.length}</strong></button>
        <button type="button" className={filter === "profit" ? "active positive" : "positive"} onClick={() => { setFilter("profit"); setPage(0); }}><span>მოგებაში</span><strong>{profitable}</strong></button>
        <button type="button" className={filter === "loss" ? "active negative" : "negative"} onClick={() => { setFilter("loss"); setPage(0); }}><span>ზარალში</span><strong>{losing}</strong></button>
        <button type="button" className={filter === "unpriced" ? "active warning" : "warning"} onClick={() => { setFilter("unpriced"); setPage(0); }}><span>ფასის გარეშე</span><strong>{unpriced}</strong></button>
      </section>
      <div className="positions-toolbar">
        <label className="positions-search">
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
        <div className="positions-filter desktop-position-filter"><SlidersHorizontal size={15} aria-hidden="true" /><select
          aria-label="შედეგის ფილტრი"
          className="max-w-44"
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
        </select></div>
        <select className="desktop-position-filter max-w-48"
          aria-label="პოზიციების დალაგება"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="value">ღირებულებით</option>
          <option value="return">შემოსავლიანობით</option>
          <option value="name">სახელით</option>
        </select>
        <div className="view-switcher desktop-position-filter" role="group" aria-label="პოზიციების ხედი">
          <button type="button" className={view === "table" ? "active" : ""} onClick={() => setView("table")} aria-label="ცხრილის ხედი"><List size={16} /></button>
          <button type="button" className={view === "cards" ? "active" : ""} onClick={() => setView("cards")} aria-label="ბარათების ხედი"><Grid2X2 size={16} /></button>
        </div>
        <div className="mobile-position-filter">
          <MobileBottomSheet title="პოზიციების ფილტრი" trigger={<button type="button" className="btn btn-ghost button-secondary"><SlidersHorizontal size={16} /> ფილტრი</button>}>
            <div className="mobile-filter-options" role="group" aria-label="შედეგის ფილტრი">
              {[["all", "ყველა", positions.length], ["profit", "მოგებაში", profitable], ["loss", "ზარალში", losing], ["unpriced", "ფასის გარეშე", unpriced]].map(([value, label, count]) => <button key={String(value)} type="button" className={filter === value ? "active" : ""} onClick={() => { setFilter(String(value)); setPage(0); }}><span>{String(label)}</span><strong>{String(count)}</strong></button>)}
            </div>
            <label className="mobile-filter-select"><span>დალაგება</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="value">ღირებულებით</option><option value="return">შემოსავლიანობით</option><option value="name">სახელით</option></select></label>
            {(search || filter !== "all" || sort !== "value") && <button type="button" className="btn btn-ghost button-secondary w-full" onClick={reset}><RotateCcw size={15} /> ფილტრების გასუფთავება</button>}
          </MobileBottomSheet>
        </div>
        {(search || filter !== "all" || sort !== "value") && <button type="button" className="toolbar-reset desktop-position-filter" onClick={reset}><RotateCcw size={14} /> გასუფთავება</button>}
      </div>
      <div className="positions-result-meta"><span><strong>{filtered.length}</strong> შედეგი</span>{search && <span>ძიება: “{search}”</span>}</div>
      <div className="positions-command-grid">
        <section className="positions-results">
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
          <span className="text-xs text-muted">
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
  return <aside className="position-brief" aria-label={`${position.asset.symbol} პოზიციის მოკლე ინფორმაცია`}>
    <header><div className="position-brief-asset"><AssetIcon symbol={position.asset.symbol} logoUrl={position.asset.logoUrl} /><div><h2>{position.asset.symbol}</h2><span>{position.asset.name}</span></div></div>{!preview && <div className="position-brief-header-actions"><PositionShare position={position} compact /><Link className="btn btn-ghost button-secondary" href={`${base}/positions/${position.assetId}`}>სრული გვერდი ↗</Link></div>}</header>
    <div className="position-brief-price"><span>მიმდინარე ფასი</span><strong>{money(position.quote?.price ?? null)}</strong><b className={pnlClass(position.quote?.change24h ?? null)}>{percentage(position.quote?.change24h ?? null, true)} · 24სთ</b></div>
    <div className="position-brief-grid"><div><span>რაოდენობა</span><b>{quantity(position.quantity)}</b></div><div><span>საშ. შესყიდვა</span><b>{money(position.averagePrice)}</b></div><div><span>ღირებულება</span><b><BalanceValue>{money(position.value)}</BalanceValue></b></div><div><span>პორტფელის წილი</span><b>{percentage(position.allocation)}</b></div></div>
    <div className={`position-brief-pnl ${positive ? "positive" : "negative"}`}><span>არარეალიზებული P/L</span><strong><BalanceValue>{position.unrealizedPnl && positive ? "+" : ""}{money(position.unrealizedPnl)}</BalanceValue></strong><b>{percentage(position.returnPercent, true)}</b></div>
    {!preview && <>
      <div className="position-brief-actions"><TransactionForm portfolioId={base.split("/").at(-1) ?? ""} revision={revision} assets={assets} initialAsset={position.assetId} triggerLabel="ტრანზაქცია" /><Link className="btn btn-ghost button-secondary" href={`${base}/positions/${position.assetId}`}>მართვა</Link></div>
      <div className="position-brief-workflows" aria-label={`${position.asset.symbol} დაგეგმვის მოქმედებები`}>
        <Link href={`${base}/positions/${position.assetId}?tab=exit`}><TrendingUp size={14} /><span>გასვლის გეგმა</span></Link>
        <Link href={`${base}/positions/${position.assetId}?tab=journal`}><NotebookPen size={14} /><span>ჟურნალი</span></Link>
      </div>
    </>}
  </aside>;
}
