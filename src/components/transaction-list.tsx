"use client";
import { FilterButtons } from "./filter-buttons";
import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Trash2,
  RotateCcw,
  Search,
  SlidersHorizontal,
  ArrowDownToLine,
  ArrowUpFromLine,
  WalletCards,
  ReceiptText,
  Gift,
} from "lucide-react";
import { decimal } from "@/domain/decimal";
import type { Asset, LedgerEntry } from "@/domain/types";
import { dateTime, money, quantity, unitPrice } from "@/lib/formatters";
import { deleteTransaction } from "@/server/actions";
import { TransactionForm, kindLabels } from "./transaction-form";
import { BalanceValue, Message, Modal } from "./ui";
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
  const resetFilters = () => {
    setSearch("");
    setKind("");
    setFrom("");
    setTo("");
    setPage(0);
  };
  return (
    <div className="space-y-3 lg:space-y-4">
      <section className="card bg-base-200">
        <div className="card-body gap-4 p-4">
          <FilterButtons
            label="სწრაფი ფილტრი"
            value={kind}
            onChange={(value) => {
              setKind(value);
              setPage(0);
            }}
            options={[
              { value: "", label: "ყველა", count: entries.length },
              ...(
                [
                  "buy",
                  "sell",
                  "deposit",
                  "withdrawal",
                  "fee",
                  "airdrop",
                ] as const
              ).map((value) => ({
                value,
                label: kindLabels[value],
                count: entries.filter((entry) => entry.kind === value).length,
              })),
            ]}
          />
          <div className="flex flex-wrap items-end gap-3">
            <label className="input min-w-0 flex-1 md:max-w-sm">
              <Search size={16} aria-hidden="true" />
              <span className="sr-only">ტრანზაქციების ძიება</span>
              <input
                aria-label="ტრანზაქციების ძიება"
                placeholder="აქტივის ან შენიშვნის ძიება…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
              />
            </label>
            <fieldset className="fieldset hidden max-w-44 md:block">
              <legend className="fieldset-legend">თარიღიდან</legend>
              <input
                className="input"
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(0);
                }}
              />
            </fieldset>
            <fieldset className="fieldset hidden max-w-44 md:block">
              <legend className="fieldset-legend">თარიღამდე</legend>
              <input
                className="input"
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(0);
                }}
              />
            </fieldset>
            <div className="lg:hidden">
              <MobileBottomSheet
                title="ტრანზაქციების ფილტრი"
                trigger={
                  <button type="button" className="btn btn-neutral">
                    <SlidersHorizontal size={16} /> ფილტრი
                  </button>
                }
              >
                <fieldset className="fieldset">
                  <legend className="fieldset-legend">ტრანზაქციის ტიპი</legend>
                  <select
                    className="select w-full"
                    value={kind}
                    onChange={(event) => {
                      setKind(event.target.value);
                      setPage(0);
                    }}
                  >
                    <option value="">ყველა ტიპი</option>
                    {Object.entries(kindLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </fieldset>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <fieldset className="fieldset">
                    <legend className="fieldset-legend">თარიღიდან</legend>
                    <input
                      className="input w-full"
                      type="date"
                      value={from}
                      onChange={(event) => {
                        setFrom(event.target.value);
                        setPage(0);
                      }}
                    />
                  </fieldset>
                  <fieldset className="fieldset">
                    <legend className="fieldset-legend">თარიღამდე</legend>
                    <input
                      className="input w-full"
                      type="date"
                      value={to}
                      onChange={(event) => {
                        setTo(event.target.value);
                        setPage(0);
                      }}
                    />
                  </fieldset>
                </div>
                {hasFilters && (
                  <button
                    type="button"
                    className="btn btn-block"
                    onClick={resetFilters}
                  >
                    <RotateCcw size={14} /> გასუფთავება
                  </button>
                )}
              </MobileBottomSheet>
            </div>
            {hasFilters && (
              <button
                type="button"
                className="btn btn-ghost hidden md:inline-flex"
                onClick={resetFilters}
              >
                <RotateCcw size={14} /> გასუფთავება
              </button>
            )}
          </div>
        </div>
      </section>
      <section className="card bg-base-200">
        <div className="flex items-center justify-between border-b border-base-300 px-5 py-4">
          <div>
            <h2 className="card-title text-base">ტრანზაქციების ისტორია</h2>
            <p className="mt-1 text-xs text-base-content/60">
              ყიდვა, გაყიდვა, შეტანა, გატანა და საკომისიოები
            </p>
          </div>
          <span className="badge">{filtered.length}</span>
        </div>
        <div className="hidden overflow-x-auto lg:block">
          <table className="table table-sm [&_td]:whitespace-nowrap [&_th]:text-right [&_th:first-child]:text-left">
            <thead>
              <tr>
                {[
                  "თარიღი",
                  "ტიპი",
                  "აქტივი",
                  "რაოდენობა",
                  "ფასი",
                  "საკომისიო",
                  "თანხა",
                  "მოქმედებები",
                ].map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered
                .slice(currentPage * 20, (currentPage + 1) * 20)
                .map((e) => (
                  <tr key={e.id}>
                    <td className="text-xs">{dateTime(e.occurredAt)}</td>
                    <td>{kindLabels[e.kind]}</td>
                    <td>
                      {assets.find((a) => a.id === e.assetId)?.symbol ??
                        e.assetId}
                    </td>
                    <td className="text-right tabular-nums">
                      <BalanceValue>{quantity(e.quantity)}</BalanceValue>
                    </td>
                    <td className="text-right tabular-nums">
                      <BalanceValue>{unitPrice(e.price)}</BalanceValue>
                    </td>
                    <td className="text-right tabular-nums">
                      <BalanceValue>{money(e.fee)}</BalanceValue>
                    </td>
                    <td className="text-right tabular-nums">
                      <BalanceValue>
                        {money(
                          e.assetId === "USD"
                            ? e.quantity
                            : e.price === null
                              ? null
                              : decimal(e.quantity).mul(e.price).toFixed(),
                        )}
                      </BalanceValue>
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <TransactionForm
                          portfolioId={portfolioId}
                          revision={revision}
                          assets={assets}
                          entry={e}
                        />
                        <button
                          type="button"
                          className="btn btn-ghost btn-square min-h-11 min-w-11 text-error"
                          aria-label="ტრანზაქციის წაშლა"
                          onClick={() => {
                            setSelected(e.id);
                            setError("");
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <ul className="list lg:hidden">
          {filtered
            .slice(currentPage * 20, (currentPage + 1) * 20)
            .map((e, index) => (
              <Fragment key={e.id}>
                {(index === 0 ||
                  dateTime(e.occurredAt).split(",")[0] !==
                    dateTime(
                      filtered[currentPage * 20 + index - 1].occurredAt,
                    ).split(",")[0]) && (
                  <li className="bg-base-100 px-3 py-2 text-xs text-base-content/60">
                    {dateTime(e.occurredAt, true)}
                  </li>
                )}
                <li
                  key={e.id}
                  className="list-row grid-cols-[minmax(0,1fr)_auto] border-b border-base-300 p-3 last:border-0"
                >
                  <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-2">
                    <span className="btn btn-square pointer-events-none">
                      <TransactionKindIcon kind={e.kind} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium">
                        {kindLabels[e.kind]} ·{" "}
                        {assets.find((a) => a.id === e.assetId)?.symbol ??
                          e.assetId}
                      </p>
                      <p className="mt-1.5 text-xs text-base-content/60">
                        {dateTime(e.occurredAt)}
                      </p>
                    </div>
                  </div>
                  <div className="col-start-2 row-start-1 whitespace-nowrap text-right tabular-nums lg:hidden">
                    <p className="text-sm">
                      <BalanceValue>{quantity(e.quantity)}</BalanceValue>
                    </p>
                    <p className="text-xs text-base-content/60">
                      <BalanceValue>
                        {money(
                          e.assetId === "USD"
                            ? e.quantity
                            : e.price === null
                              ? null
                              : decimal(e.quantity).mul(e.price).toFixed(),
                        )}
                      </BalanceValue>
                    </p>
                  </div>
                  <details className="collapse collapse-arrow col-span-2 row-start-2 bg-base-100 lg:hidden">
                    <summary className="collapse-title min-h-11 py-3 text-xs font-medium">
                      დეტალები და მოქმედებები
                    </summary>
                    <div className="collapse-content">
                      {e.notes && (
                        <p className="mb-2 break-words text-xs text-base-content/60">
                          {e.notes}
                        </p>
                      )}
                      <p className="text-xs text-base-content/60">
                        {e.price ? (
                          <>
                            ფასი:{" "}
                            <BalanceValue>{unitPrice(e.price)}</BalanceValue>
                          </>
                        ) : (
                          "ფასი არ არის მითითებული"
                        )}{" "}
                        · საკომისიო: <BalanceValue>{money(e.fee)}</BalanceValue>
                      </p>
                      <div className="mt-3 flex gap-2">
                        <TransactionForm
                          portfolioId={portfolioId}
                          revision={revision}
                          assets={assets}
                          entry={e}
                        />
                        <button
                          className="btn btn-error min-h-11"
                          type="button"
                          onClick={() => {
                            setSelected(e.id);
                            setError("");
                          }}
                        >
                          წაშლა
                        </button>
                      </div>
                    </div>
                  </details>
                </li>
              </Fragment>
            ))}
          {!filtered.length && (
            <li className="p-10 text-center text-sm text-base-content/60">
              ტრანზაქციები ვერ მოიძებნა.
            </li>
          )}
        </ul>
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
        <div className="space-y-3 lg:space-y-4">
          {error && <Message error>{error}</Message>}
          <div className="flex justify-end gap-3">
            <button
              className="btn btn-ghost"
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
  if (kind === "deposit" || kind === "withdrawal")
    return <WalletCards size={17} />;
  if (kind === "airdrop") return <Gift size={17} />;
  return <ReceiptText size={17} />;
}
