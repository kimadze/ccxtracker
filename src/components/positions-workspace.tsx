"use client";
import { useState } from "react";
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
    [page, setPage] = useState(0);
  const filtered = positions
    .filter(
      (p) =>
        `${p.asset.name} ${p.asset.symbol}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (filter === "all" ||
          (p.unrealizedPnl !== null &&
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
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3">
        <input
          className="max-w-sm"
          aria-label="პოზიციების ძიება"
          placeholder="აქტივის ძიება…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
        <select
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
        </select>
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
      </div>
      <section className="panel">
        <PositionsTable
          positions={filtered.slice(current * 20, current * 20 + 20)}
          base={base}
          preview={preview}
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
