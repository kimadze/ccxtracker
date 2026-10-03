"use client";
import { useState } from "react";
import {
  Grid2X2,
  List,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import type { Asset, ValuedPosition } from "@/domain/types";
import { decimal } from "@/domain/decimal";
import { PositionsTable } from "./positions";
import { MobileBottomSheet } from "./mobile-components";
export function PositionsWorkspace({
  positions,
  base,
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
    [selectedAssetId, setSelectedAssetId] = useState(
      positions[0]?.assetId ?? "",
    ),
    [page, setPage] = useState(0);
  const filtered = positions
    .filter(
      (p) =>
        `${p.asset.name} ${p.asset.symbol}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (filter === "all" ||
          (filter === "unpriced"
            ? p.value === null
            : p.unrealizedPnl !== null &&
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
  const profitable = positions.filter(
    (position) =>
      position.unrealizedPnl !== null && decimal(position.unrealizedPnl).gt(0),
  ).length;
  const losing = positions.filter(
    (position) =>
      position.unrealizedPnl !== null && decimal(position.unrealizedPnl).lt(0),
  ).length;
  const unpriced = positions.filter(
    (position) => position.value === null,
  ).length;
  const reset = () => {
    setSearch("");
    setFilter("all");
    setSort("value");
    setPage(0);
  };
  const selected =
    filtered.find((position) => position.assetId === selectedAssetId) ??
    filtered[0] ??
    positions[0];
  return (
    <div className="space-y-3 lg:space-y-4">
      <section
        className="tabs tabs-border hidden w-full flex-nowrap overflow-x-auto lg:flex"
        role="group"
        aria-label="პოზიციების ფილტრები"
      >
        <button
          aria-pressed={filter === "all"}
          type="button"
          className={`tab min-h-11 shrink-0 gap-2 ${filter === "all" ? "tab-active" : ""}`}
          onClick={() => {
            setFilter("all");
            setPage(0);
          }}
        >
          ყველა <span className="badge badge-sm">{positions.length}</span>
        </button>
        <button
          aria-pressed={filter === "profit"}
          type="button"
          className={`tab min-h-11 shrink-0 gap-2 ${filter === "profit" ? "tab-active" : ""}`}
          onClick={() => {
            setFilter("profit");
            setPage(0);
          }}
        >
          მოგებაში <span className="badge badge-sm">{profitable}</span>
        </button>
        <button
          aria-pressed={filter === "loss"}
          type="button"
          className={`tab min-h-11 shrink-0 gap-2 ${filter === "loss" ? "tab-active" : ""}`}
          onClick={() => {
            setFilter("loss");
            setPage(0);
          }}
        >
          ზარალში <span className="badge badge-sm">{losing}</span>
        </button>
        <button
          aria-pressed={filter === "unpriced"}
          type="button"
          className={`tab min-h-11 shrink-0 gap-2 ${filter === "unpriced" ? "tab-active" : ""}`}
          onClick={() => {
            setFilter("unpriced");
            setPage(0);
          }}
        >
          ფასის გარეშე <span className="badge badge-sm">{unpriced}</span>
        </button>
      </section>
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <label className="input min-h-11 min-w-0 flex-1">
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
          <select
            className="select hidden min-h-11 max-w-48 lg:block"
            aria-label="პოზიციების დალაგება"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="value">ღირებულებით</option>
            <option value="return">შემოსავლიანობით</option>
            <option value="name">სახელით</option>
          </select>
          <div
            className="join hidden lg:flex"
            role="group"
            aria-label="პოზიციების ხედი"
          >
            <button
              type="button"
              className={`btn btn-square join-item ${view === "table" ? "btn-soft btn-primary" : "btn-ghost"}`}
              aria-pressed={view === "table"}
              onClick={() => setView("table")}
              aria-label="ცხრილის ხედი"
            >
              <List size={16} />
            </button>
            <button
              type="button"
              className={`btn btn-square join-item ${view === "cards" ? "btn-soft btn-primary" : "btn-ghost"}`}
              aria-pressed={view === "cards"}
              onClick={() => setView("cards")}
              aria-label="ბარათების ხედი"
            >
              <Grid2X2 size={16} />
            </button>
          </div>
          <div className="shrink-0 lg:hidden">
            <MobileBottomSheet
              title="პოზიციების ფილტრი"
              trigger={
                <button
                  type="button"
                  className="btn btn-dash min-h-11 gap-2"
                >
                  <SlidersHorizontal size={16} /> ფილტრი
                  {filter !== "all" && (
                    <span className="badge badge-sm">1</span>
                  )}
                </button>
              }
            >
              <div
                className="grid gap-2"
                role="group"
                aria-label="შედეგის ფილტრი"
              >
                {[
                  ["all", "ყველა", positions.length],
                  ["profit", "მოგებაში", profitable],
                  ["loss", "ზარალში", losing],
                  ["unpriced", "ფასის გარეშე", unpriced],
                ].map(([value, label, count]) => (
                  <button
                    key={String(value)}
                    type="button"
                    className={`btn min-h-11 justify-between ${filter === value ? "btn-soft btn-primary" : "btn-ghost"}`}
                    aria-pressed={filter === value}
                    onClick={() => {
                      setFilter(String(value));
                      setPage(0);
                    }}
                  >
                    <span>{String(label)}</span>
                    <strong>{String(count)}</strong>
                  </button>
                ))}
              </div>
              <label className="fieldset mt-3">
                <span>დალაგება</span>
                <select
                  className="select"
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                >
                  <option value="value">ღირებულებით</option>
                  <option value="return">შემოსავლიანობით</option>
                  <option value="name">სახელით</option>
                </select>
              </label>
              {(search || filter !== "all" || sort !== "value") && (
                <button
                  type="button"
                  className="btn btn-ghost w-full"
                  onClick={reset}
                >
                  <RotateCcw size={15} /> ფილტრების გასუფთავება
                </button>
              )}
            </MobileBottomSheet>
          </div>
          {(search || filter !== "all" || sort !== "value") && (
            <button
              type="button"
              className="btn btn-dash hidden lg:inline-flex"
              onClick={reset}
            >
              <RotateCcw size={14} /> გასუფთავება
            </button>
          )}
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-3 text-xs text-base-content/60">
        <span>
          <strong className="text-base-content">{filtered.length}</strong>{" "}
          შედეგი
        </span>
        {search && <span className="truncate">ძიება: “{search}”</span>}
      </div>
      <div className="min-w-0">
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
      </div>
      {filtered.length > 20 && (
        <div className="flex items-center justify-end gap-3">
          <button
            className="btn btn-ghost"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            წინა
          </button>
          <span className="text-sm text-base-content/55">
            {current + 1} / {pages}
          </span>
          <button
            className="btn btn-ghost"
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
