"use client";
import { useState } from "react";
import { Grid2X2, List, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import type { ValuedPosition } from "@/domain/types";
import { decimal } from "@/domain/decimal";
import { PositionsTable } from "./positions";
export function PositionsWorkspace({
  positions,
  base,
  preview = false,
}: {
  positions: ValuedPosition[];
  base: string;
  preview?: boolean;
}) {
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [sort, setSort] = useState("value"),
    [view, setView] = useState<"table" | "cards">("table"),
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
  return (
    <div className="positions-workspace space-y-4">
      <section className="position-summary" aria-label="პოზიციების მოკლე შეჯამება">
        <button type="button" className={filter === "all" ? "active" : ""} onClick={() => { setFilter("all"); setPage(0); }}><span>ყველა</span><strong>{positions.length}</strong></button>
        <button type="button" className={filter === "profit" ? "active positive" : "positive"} onClick={() => { setFilter("profit"); setPage(0); }}><span>მოგებაში</span><strong>{profitable}</strong></button>
        <button type="button" className={filter === "loss" ? "active negative" : "negative"} onClick={() => { setFilter("loss"); setPage(0); }}><span>ზარალში</span><strong>{losing}</strong></button>
        <button type="button" className={filter === "unpriced" ? "active warning" : "warning"} onClick={() => { setFilter("unpriced"); setPage(0); }}><span>ფასის გარეშე</span><strong>{unpriced}</strong></button>
      </section>
      <div className="panel positions-toolbar">
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
        <div className="positions-filter"><SlidersHorizontal size={15} aria-hidden="true" /><select
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
        <select
          aria-label="პოზიციების დალაგება"
          className="max-w-48"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="value">ღირებულებით</option>
          <option value="return">შემოსავლიანობით</option>
          <option value="name">სახელით</option>
        </select>
        <div className="view-switcher" role="group" aria-label="პოზიციების ხედი">
          <button type="button" className={view === "table" ? "active" : ""} onClick={() => setView("table")} aria-label="ცხრილის ხედი"><List size={16} /></button>
          <button type="button" className={view === "cards" ? "active" : ""} onClick={() => setView("cards")} aria-label="ბარათების ხედი"><Grid2X2 size={16} /></button>
        </div>
        {(search || filter !== "all" || sort !== "value") && <button type="button" className="toolbar-reset" onClick={reset}><RotateCcw size={14} /> გასუფთავება</button>}
      </div>
      <div className="positions-result-meta"><span><strong>{filtered.length}</strong> შედეგი</span>{search && <span>ძიება: “{search}”</span>}</div>
      <section className="panel positions-results">
        <PositionsTable
          positions={filtered.slice(current * 20, current * 20 + 20)}
          base={base}
          preview={preview}
          view={view === "cards" ? "cards" : "auto"}
        />
      </section>
      {filtered.length > 20 && (
        <div className="flex items-center justify-end gap-3">
          <button
            className="button-secondary"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            წინა
          </button>
          <span className="text-xs text-muted">
            {current + 1} / {pages}
          </span>
          <button
            className="button-secondary"
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
