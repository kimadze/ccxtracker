"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, ArrowLeftRight, RotateCcw, Search } from "lucide-react";
import type { Asset, LedgerEntry } from "@/domain/types";
import { dateTime, money, quantity } from "@/lib/formatters";
import { deleteTransaction } from "@/server/actions";
import { TransactionForm, kindLabels } from "./transaction-form";
import { Message, Modal } from "./ui";

export function TransactionList({
  entries,
  assets,
  portfolioId,
  revision,
}: {
  entries: LedgerEntry[];
  assets: Asset[];
  portfolioId: string;
  revision: number;
}) {
  const [search, setSearch] = useState(""),
    [kind, setKind] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [selected, setSelected] = useState<string | null>(null),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [page, setPage] = useState(0);
  const router = useRouter();
  const filtered = [...entries]
    .reverse()
    .filter(
      (e) =>
        (!kind || e.kind === kind) &&
        (!from ||
          Date.parse(e.occurredAt) >= Date.parse(`${from}T00:00:00+04:00`)) &&
        (!to ||
          Date.parse(e.occurredAt) <
            Date.parse(`${to}T00:00:00+04:00`) + 86400000) &&
        (!search ||
          `${assets.find((a) => a.id === e.assetId)?.symbol} ${e.notes ?? ""}`
            .toLowerCase()
            .includes(search.toLowerCase())),
    );
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const currentPage = Math.min(page, pages - 1);
  const hasFilters = Boolean(search || kind || from || to);
  const resetFilters = () => { setSearch(""); setKind(""); setFrom(""); setTo(""); setPage(0); };
  return (
    <div className="space-y-5">
      <div className="panel ledger-toolbar">
      <div className="flex flex-wrap items-end gap-3">
        <label className="positions-search max-w-sm"><Search size={16} aria-hidden="true" /><span className="sr-only">ტრანზაქციების ძიება</span><input
          aria-label="ტრანზაქციების ძიება"
          placeholder="აქტივის ან შენიშვნის ძიება…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        /></label>
        <select
          className="max-w-48"
          aria-label="ტრანზაქციის ტიპი"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            setPage(0);
          }}
        >
          <option value="">ყველა ტიპი</option>
          {Object.entries(kindLabels).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <label className="max-w-44 text-[10px] text-muted">
          თარიღიდან (თბილისი)
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label className="max-w-44 text-[10px] text-muted">
          თარიღამდე (თბილისი)
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(0);
            }}
          />
        </label>
        {hasFilters && <button type="button" className="button-secondary" onClick={resetFilters}><RotateCcw size={14} /> გასუფთავება</button>}
      </div></div>
      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4"><div><h2 className="text-sm font-semibold">ტრანზაქციების ისტორია</h2><p className="mt-1 text-[10px] text-muted">ყიდვა, გაყიდვა, შეტანა, გატანა და საკომისიოები</p></div><span className="rounded-md bg-raised px-2 py-1 text-[10px] text-muted">{filtered.length}</span></div>
        <div className="divide-y divide-line">
        {filtered.slice(currentPage * 20, (currentPage + 1) * 20).map((e) => (
          <div
            key={e.id}
            className="transaction-row flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-raised/40"
          >
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-raised p-2 text-brand">
                <ArrowLeftRight size={17} />
              </span>
              <div>
                <p className="text-xs font-medium">
                  {kindLabels[e.kind]} ·{" "}
                  {assets.find((a) => a.id === e.assetId)?.symbol ?? e.assetId}
                </p>
                <p className="mt-1.5 text-[10px] text-muted">
                  {dateTime(e.occurredAt)}
                </p>
                {e.notes && (
                  <p className="mt-2 max-w-sm break-words text-xs text-muted">
                    {e.notes}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <div className="text-right">
                <p className="numeric text-sm">{quantity(e.quantity)}</p>
                <p className="mt-1 text-[10px] text-muted">
                  {e.price ? `ფასი: ${money(e.price)}` : "—"} · საკომისიო:{" "}
                  {money(e.fee)}
                </p>
              </div>
              <TransactionForm
                portfolioId={portfolioId}
                revision={revision}
                assets={assets}
                entry={e}
              />
              <button
                className="rounded p-2 text-muted hover:text-negative"
                aria-label="ტრანზაქციის წაშლა"
                onClick={() => {
                  setSelected(e.id);
                  setError("");
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        {!filtered.length && (
          <p className="px-5 py-20 text-center text-sm text-muted">
            ტრანზაქციები ვერ მოიძებნა.
          </p>
        )}</div>
      </div>
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{filtered.length} ტრანზაქცია</span>
        <div className="flex items-center gap-3">
          <button
            className="button-secondary"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            წინა
          </button>
          <span>
            {currentPage + 1} / {pages}
          </span>
          <button
            className="button-secondary"
            disabled={currentPage + 1 >= pages}
            onClick={() => setPage(currentPage + 1)}
          >
            შემდეგი
          </button>
        </div>
      </div>
      <Modal
        open={selected !== null}
        onOpenChange={(v) => {
          if (!v && !pending) setSelected(null);
        }}
        title="ტრანზაქციის წაშლა"
        description="ტრანზაქციის წაშლის შემდეგ მთელი ისტორია თავიდან გამოითვლება. მოქმედებამ შეიძლება შეცვალოს პოზიციები და მოგება / ზარალი."
      >
        <div className="space-y-5">
          {error && <Message error>{error}</Message>}
          <div className="flex justify-end gap-3">
            <button
              className="button-secondary"
              onClick={() => setSelected(null)}
              disabled={pending}
            >
              გაუქმება
            </button>
            <button
              className="button-danger"
              disabled={pending}
              onClick={async () => {
                if (!selected) return;
                setPending(true);
                try {
                  const result = await deleteTransaction(
                    portfolioId,
                    selected,
                    revision,
                  );
                  if (result.ok) {
                    setSelected(null);
                    router.refresh();
                  } else setError(result.error);
                } catch {
                  setError("წაშლა ვერ მოხერხდა.");
                } finally {
                  setPending(false);
                }
              }}
            >
              {pending ? "იშლება…" : "წაშლა"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
