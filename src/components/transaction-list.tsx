"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, RotateCcw, Search, SlidersHorizontal, ArrowDownToLine, ArrowUpFromLine, WalletCards, ReceiptText, Gift } from "lucide-react";
import type { Asset, LedgerEntry } from "@/domain/types";
import { dateTime, money, quantity } from "@/lib/formatters";
import { deleteTransaction } from "@/server/actions";
import { TransactionForm, kindLabels } from "./transaction-form";
import { Message, Modal } from "./ui";
import { MobileBottomSheet } from "./mobile-components";

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
      <section className="card card-border bg-base-200">
        <div className="card-body gap-4 p-4 sm:p-5">
        <div className="tabs tabs-box overflow-x-auto" role="group" aria-label="სწრაფი ფილტრი">
          <button type="button" className={`tab shrink-0 ${!kind ? "tab-active" : ""}`} onClick={() => { setKind(""); setPage(0); }}>ყველა <span className="badge badge-sm ml-2">{entries.length}</span></button>
          {(["buy", "sell", "deposit", "withdrawal", "fee", "airdrop"] as const).map((value) => <button key={value} type="button" className={`tab shrink-0 ${kind === value ? "tab-active" : ""}`} onClick={() => { setKind(value); setPage(0); }}>{kindLabels[value]} <span className="badge badge-sm ml-2">{entries.filter((entry) => entry.kind === value).length}</span></button>)}
        </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="input min-w-0 flex-1 md:max-w-sm"><Search size={16} aria-hidden="true" /><span className="sr-only">ტრანზაქციების ძიება</span><input
          aria-label="ტრანზაქციების ძიება"
          placeholder="აქტივის ან შენიშვნის ძიება…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        /></label>
        <select className="select hidden md:inline-flex"
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
        <fieldset className="fieldset hidden max-w-44 md:block"><legend className="fieldset-legend">თარიღიდან</legend>
          <input className="input"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(0);
            }}
          />
        </fieldset>
        <fieldset className="fieldset hidden max-w-44 md:block"><legend className="fieldset-legend">თარიღამდე</legend>
          <input className="input"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(0);
            }}
          />
        </fieldset>
        <div className="md:hidden"><MobileBottomSheet title="ტრანზაქციების ფილტრი" trigger={<button type="button" className="btn"><SlidersHorizontal size={16} /> ფილტრი</button>}>
          <fieldset className="fieldset"><legend className="fieldset-legend">ტრანზაქციის ტიპი</legend><select className="select w-full" value={kind} onChange={(event) => { setKind(event.target.value); setPage(0); }}><option value="">ყველა ტიპი</option>{Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></fieldset>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><fieldset className="fieldset"><legend className="fieldset-legend">თარიღიდან</legend><input className="input w-full" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(0); }} /></fieldset><fieldset className="fieldset"><legend className="fieldset-legend">თარიღამდე</legend><input className="input w-full" type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(0); }} /></fieldset></div>
          {hasFilters && <button type="button" className="btn btn-block" onClick={resetFilters}><RotateCcw size={14} /> გასუფთავება</button>}
        </MobileBottomSheet></div>
        {hasFilters && <button type="button" className="btn hidden md:inline-flex" onClick={resetFilters}><RotateCcw size={14} /> გასუფთავება</button>}
      </div></div></section>
      <section className="card card-border bg-base-200">
        <div className="flex items-center justify-between border-b border-base-300 px-5 py-4"><div><h2 className="card-title text-base">ტრანზაქციების ისტორია</h2><p className="mt-1 text-xs text-base-content/60">ყიდვა, გაყიდვა, შეტანა, გატანა და საკომისიოები</p></div><span className="badge">{filtered.length}</span></div>
        <ul className="list">
        {filtered.slice(currentPage * 20, (currentPage + 1) * 20).map((e) => (
          <li
            key={e.id}
            className="list-row border-b border-base-300 px-4 py-4 last:border-0 sm:px-5"
          >
            <div className="flex items-center gap-3">
              <span className="btn btn-square pointer-events-none">
                <TransactionKindIcon kind={e.kind} />
              </span>
              <div>
                <p className="text-xs font-medium">
                  {kindLabels[e.kind]} ·{" "}
                  {assets.find((a) => a.id === e.assetId)?.symbol ?? e.assetId}
                </p>
                <p className="mt-1.5 text-xs text-base-content/60">
                  {dateTime(e.occurredAt)}
                </p>
                {e.notes && (
                  <p className="mt-2 max-w-sm break-words text-xs text-base-content/60">
                    {e.notes}
                  </p>
                )}
              </div>
            </div>
            <div className="hidden items-center gap-4 md:flex">
              <div className="text-right">
                <p className="numeric text-sm">{quantity(e.quantity)}</p>
                <p className="mt-1 text-xs text-base-content/60">
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
                className="btn btn-ghost btn-square btn-sm text-error"
                aria-label="ტრანზაქციის წაშლა"
                onClick={() => {
                  setSelected(e.id);
                  setError("");
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
            <details className="collapse collapse-arrow list-col-wrap bg-base-100 md:hidden"><summary className="collapse-title min-h-11 py-3 text-xs font-medium">დეტალები და მოქმედებები</summary><div className="collapse-content"><p className="text-xs text-base-content/60">{e.price ? `ფასი: ${money(e.price)}` : "ფასი არ არის მითითებული"} · საკომისიო: {money(e.fee)}</p><div className="mt-3 flex gap-2"><TransactionForm portfolioId={portfolioId} revision={revision} assets={assets} entry={e} /><button className="btn btn-error btn-sm" type="button" onClick={() => { setSelected(e.id); setError(""); }}>წაშლა</button></div></div></details>
          </li>
        ))}
        {!filtered.length && (
          <li className="p-10 text-center text-sm text-base-content/60">
            ტრანზაქციები ვერ მოიძებნა.
          </li>
        )}</ul>
      </section>
      <div className="flex items-center justify-between text-xs text-base-content/60">
        <span>{filtered.length} ტრანზაქცია</span>
        <div className="join">
          <button
            className="btn join-item"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            წინა
          </button>
          <span className="btn join-item pointer-events-none">
            {currentPage + 1} / {pages}
          </span>
          <button
            className="btn join-item"
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
              className="btn"
              onClick={() => setSelected(null)}
              disabled={pending}
            >
              გაუქმება
            </button>
            <button
              className="btn btn-error"
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
function TransactionKindIcon({ kind }: { kind: LedgerEntry["kind"] }) {
  if (kind === "buy") return <ArrowDownToLine size={17} />;
  if (kind === "sell") return <ArrowUpFromLine size={17} />;
  if (kind === "deposit" || kind === "withdrawal") return <WalletCards size={17} />;
  if (kind === "airdrop") return <Gift size={17} />;
  return <ReceiptText size={17} />;
}
