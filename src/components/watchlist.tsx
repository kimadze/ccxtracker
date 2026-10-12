"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { decimal } from "@/domain/decimal";
import {
  Eye,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import type { Asset, Quote } from "@/domain/types";
import { saveWatchlist, removeWatchlist } from "@/server/settings-actions";
import { searchAssets } from "@/server/actions";
import { dateTime, percentage, pnlClass, unitPrice } from "@/lib/formatters";
import { PageHeading } from "./shell";
import { AssetIcon } from "./positions";
import { BalanceValue, Field, Message, Modal } from "./ui";
export interface WatchItem {
  id: string;
  asset: Asset;
  entryPrice: string | null;
  exitPrice?: string | null;
  targetReachedAt?: string | null;
  targetReachedPrice?: string | null;
  sellTargetReachedAt?: string | null;
  sellTargetReachedPrice?: string | null;
  notes: string;
  createdAt: string;
}
export function Watchlist({
  portfolioId,
  revision,
  assets,
  items,
  quotes,
  preview = false,
}: {
  portfolioId: string;
  revision: number;
  assets: Asset[];
  items: WatchItem[];
  quotes: Quote[];
  preview?: boolean;
}) {
  void revision;
  const [open, setOpen] = useState(false),
    [selected, setSelected] = useState<WatchItem | null>(null),
    [detailsItem, setDetailsItem] = useState<WatchItem | null>(null),
    [deleting, setDeleting] = useState<string | null>(null),
    [options, setOptions] = useState(assets.filter((a) => a.id !== "USD")),
    [assetId, setAssetId] = useState(
      assets.find((a) => a.id !== "USD")?.id ?? "",
    ),
    [filterQuery, setFilterQuery] = useState(""),
    [movement, setMovement] = useState<
      "all" | "pending" | "sent" | "up" | "down" | "unpriced"
    >("all"),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const router = useRouter();
  const focusedAsset = useSearchParams().get("asset");
  const filteredItems = items.filter((item) => {
    const quote = quotes.find((q) => q.assetId === item.asset.id);
    const matchesText = `${item.asset.name} ${item.asset.symbol}`
      .toLowerCase()
      .includes(filterQuery.toLowerCase());
    if (!matchesText) return false;
    if (focusedAsset && item.asset.id !== focusedAsset) return false;
    if (movement === "pending")
      return Boolean(
        (item.entryPrice && !item.targetReachedAt) ||
        (item.exitPrice && !item.sellTargetReachedAt),
      );
    if (movement === "sent")
      return Boolean(item.targetReachedAt || item.sellTargetReachedAt);
    if (movement === "up") return Number(quote?.change24h ?? 0) > 0;
    if (movement === "down") return Number(quote?.change24h ?? 0) < 0;
    if (movement === "unpriced")
      return quote?.price === null || quote?.price === undefined;
    return true;
  });
  function edit(item: WatchItem) {
    setDetailsItem(null);
    setSelected(item);
    setAssetId(item.asset.id);
    setError("");
    setOpen(true);
  }
  function identity(item: WatchItem, index: number) {
    return (
      <div className="flex min-w-0 items-center gap-3">
        <AssetIcon
          symbol={item.asset.symbol}
          logoUrl={item.asset.logoUrl}
          index={index}
        />
        <div className="min-w-0">
          <p className="font-semibold">{item.asset.symbol}</p>
          <p
            className="max-w-48 truncate text-xs text-base-content/55"
            title={item.asset.name}
          >
            {item.asset.name}
          </p>
        </div>
      </div>
    );
  }
  function price(quote: Quote | undefined) {
    return (
      <div className="shrink-0 text-right">
        <strong className="numeric whitespace-nowrap text-base">
          {unitPrice(quote?.price ?? null)}
        </strong>
        <p
          className={
            "mt-0.5 text-xs " +
            pnlClass(quote?.change24h == null ? null : String(quote.change24h))
          }
        >
          {quote?.stale
            ? "მოძველებული ფასი"
            : percentage(
                quote?.change24h == null ? null : String(quote.change24h),
                true,
              )}
        </p>
      </div>
    );
  }
  function target(
    item: WatchItem,
    side: "buy" | "sell",
    quote: Quote | undefined,
  ) {
    const value = side === "buy" ? item.entryPrice : item.exitPrice;
    const reached =
      side === "buy" ? item.targetReachedAt : item.sellTargetReachedAt;
    if (!value)
      return preview ? (
        <span className="text-base-content/40">—</span>
      ) : (
        <button
          className="btn btn-ghost btn-sm min-h-11 px-2 text-base-content/55"
          aria-label={
            item.asset.symbol +
            (side === "buy" ? " ყიდვის" : " გაყიდვის") +
            " სამიზნის დამატება"
          }
          onClick={() => edit(item)}
        >
          <Plus size={13} /> დამატება
        </button>
      );
    return (
      <div className="shrink-0 text-right">
        <strong className="numeric whitespace-nowrap font-medium">
          <BalanceValue>{unitPrice(value)}</BalanceValue>
        </strong>
        <p className="mt-0.5 text-xs text-base-content/55">
          {reached
            ? "გაგზავნილია"
            : quote?.stale || quote?.price == null
              ? "ფასი მიუწვდომელია"
              : "ელოდება"}
        </p>
      </div>
    );
  }
  function actions(item: WatchItem) {
    if (preview) return null;
    return (
      <div className="flex items-center justify-end gap-1">
        <button
          className="btn btn-ghost btn-square min-h-11 min-w-11"
          aria-label={item.asset.symbol + " რედაქტირება"}
          title="რედაქტირება"
          onClick={() => edit(item)}
        >
          <Pencil size={16} />
        </button>
        <details className="dropdown dropdown-end">
          <summary
            role="button"
            className="btn btn-ghost btn-square min-h-11 min-w-11"
            aria-label={item.asset.symbol + " სხვა მოქმედებები"}
          >
            <MoreHorizontal size={18} />
          </summary>
          <ul className="menu dropdown-content z-20 w-44 rounded-box border border-base-300 bg-base-200 p-1 shadow-lg">
            <li>
              <button
                className="min-h-11"
                onClick={(event) => {
                  event.currentTarget
                    .closest("details")
                    ?.removeAttribute("open");
                  setDetailsItem(item);
                }}
              >
                დეტალები
              </button>
            </li>
            <li>
              <button
                className="min-h-11 text-error"
                onClick={(event) => {
                  event.currentTarget
                    .closest("details")
                    ?.removeAttribute("open");
                  setDeleting(item.id);
                  setError("");
                }}
              >
                <Trash2 size={15} /> წაშლა
              </button>
            </li>
          </ul>
        </details>
      </div>
    );
  }
  return (
    <div className="space-y-3 lg:space-y-4">
      {!preview && (
        <PageHeading
          eyebrow=""
          title="დაკვირვების სია"
          description=""
          action={
            <button
              className="btn btn-primary"
              onClick={() => {
                setSelected(null);
                setError("");
                setOpen(true);
              }}
            >
              <Plus size={16} /> აქტივის დამატება
            </button>
          }
        />
      )}
      {!preview && (
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <label className="input min-h-11 w-full min-w-0">
            <Search size={17} />
            <input
              value={filterQuery}
              onChange={(event) => setFilterQuery(event.target.value)}
              aria-label="დაკვირვების სიის ძიება"
              placeholder="მოძებნეთ აქტივი ან სიმბოლო…"
            />
          </label>
          <select
            className="select select-sm min-h-11 w-auto max-w-36"
            aria-label="დაკვირვების სიის ფილტრი"
            value={movement}
            onChange={(event) =>
              setMovement(event.target.value as typeof movement)
            }
          >
            <option value="all">ყველა · {items.length}</option>
            <option value="pending">მოლოდინში</option>
            <option value="sent">გაგზავნილი</option>
            <option value="up">ფასი იზრდება</option>
            <option value="down">ფასი იკლებს</option>
            <option value="unpriced">ფასის გარეშე</option>
          </select>
        </div>
      )}
      <p className="text-xs text-base-content/55">
        {filteredItems.length} აქტივი
        {focusedAsset ? " · შეტყობინებიდან გახსნილი" : ""}
      </p>
      {filteredItems.length > 0 ? (
        <>
          <div className="hidden rounded-box border border-base-300 bg-base-200 lg:block">
            <table className="table w-full table-fixed">
              <colgroup>
                <col className="w-[26%]" />
                <col className="w-[20%]" />
                <col className="w-[20%]" />
                <col className="w-[20%]" />
                <col className="w-[14%]" />
              </colgroup>
              <thead>
                <tr>
                  <th>აქტივი</th>
                  <th className="text-right">მიმდინარე ფასი</th>
                  <th className="text-right">ყიდვის სამიზნე ↓</th>
                  <th className="text-right">გაყიდვის სამიზნე ↑</th>
                  <th>
                    <span className="sr-only">მოქმედებები</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, i) => {
                  const quote = quotes.find((q) => q.assetId === item.asset.id);
                  return (
                    <tr key={item.id}>
                      <td className="py-3">{identity(item, i)}</td>
                      <td>{price(quote)}</td>
                      <td>{target(item, "buy", quote)}</td>
                      <td>{target(item, "sell", quote)}</td>
                      <td>{actions(item)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ul className="list rounded-box border border-base-300 bg-base-200 lg:hidden">
            {filteredItems.map((item, i) => {
              const quote = quotes.find((q) => q.assetId === item.asset.id);
              return (
                <li
                  className="list-row block min-w-0 border-b border-base-300 p-3 last:border-0"
                  key={item.id}
                >
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    {identity(item, i)}
                    {price(quote)}
                  </div>
                  <div className="mt-3 border-t border-base-300 pt-1">
                    <div className="flex min-h-11 items-center justify-between gap-3">
                      <span className="text-sm text-base-content/65">
                        ყიდვის სამიზნე ↓
                      </span>
                      {target(item, "buy", quote)}
                    </div>
                    <div className="flex min-h-11 items-center justify-between gap-3">
                      <span className="text-sm text-base-content/65">
                        გაყიდვის სამიზნე ↑
                      </span>
                      {target(item, "sell", quote)}
                    </div>
                  </div>
                  {!preview && (
                    <div className="mt-1 flex items-center justify-between">
                      <button
                        className="btn btn-ghost btn-sm min-h-11 px-0 text-base-content/55"
                        onClick={() => setDetailsItem(item)}
                      >
                        დეტალები
                      </button>
                      {actions(item)}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <div className="rounded-box border border-base-300 px-4 py-6 text-center">
          <Eye size={22} className="mx-auto text-base-content/40" />
          <h2 className="mt-2 font-semibold">
            {items.length
              ? "აქტივი ვერ მოიძებნა"
              : "დაკვირვების სია ჯერ ცარიელია"}
          </h2>
          <p className="mt-1 text-sm text-base-content/55">
            {items.length
              ? "შეცვალეთ ძიება ან ფილტრი."
              : "დაამატეთ აქტივი და მიუთითეთ სასურველი ფასი."}
          </p>
        </div>
      )}
      <Modal
        open={detailsItem !== null}
        description=""
        onOpenChange={(value) => {
          if (!value) setDetailsItem(null);
        }}
        title={
          detailsItem ? detailsItem.asset.symbol + " · დეტალები" : "დეტალები"
        }
      >
        {detailsItem && (
          <div className="space-y-4">
            {(["buy", "sell"] as const).map((side) => {
              const value =
                side === "buy" ? detailsItem.entryPrice : detailsItem.exitPrice;
              const reachedAt =
                side === "buy"
                  ? detailsItem.targetReachedAt
                  : detailsItem.sellTargetReachedAt;
              const reachedPrice =
                side === "buy"
                  ? detailsItem.targetReachedPrice
                  : detailsItem.sellTargetReachedPrice;
              const quote = quotes.find(
                (q) => q.assetId === detailsItem.asset.id,
              );
              const gap =
                value &&
                decimal(value).gt(0) &&
                quote?.price != null &&
                !quote.stale
                  ? decimal(quote.price)
                      .minus(value)
                      .div(value)
                      .times(100)
                      .abs()
                  : null;
              return (
                <section key={side} className="border-b border-base-300 pb-3">
                  <h3 className="mb-2 font-medium">
                    {side === "buy" ? "ყიდვის სამიზნე ↓" : "გაყიდვის სამიზნე ↑"}
                  </h3>
                  <div className="flex items-center justify-between">
                    {target(detailsItem, side, quote)}
                  </div>
                  {reachedAt ? (
                    <p className="mt-2 text-xs text-base-content/60">
                      დაფიქსირდა{" "}
                      <BalanceValue>{unitPrice(reachedPrice)}</BalanceValue> ·{" "}
                      {dateTime(reachedAt)}
                    </p>
                  ) : gap ? (
                    <p className="mt-2 text-xs text-base-content/60">
                      სამიზნემდე{" "}
                      <BalanceValue>{percentage(gap.toString())}</BalanceValue>
                    </p>
                  ) : null}
                </section>
              );
            })}
            {detailsItem.notes && (
              <div>
                <h3 className="mb-1 text-sm font-medium">შენიშვნა</h3>
                <p className="whitespace-pre-wrap break-words text-sm text-base-content/65">
                  {detailsItem.notes}
                </p>
              </div>
            )}
            <p className="text-xs text-base-content/50">
              დამატებულია {dateTime(detailsItem.createdAt)}
            </p>
          </div>
        )}
      </Modal>
      <Modal
        open={open}
        closeDisabled={pending}
        onOpenChange={(value) => {
          if (!pending) setOpen(value);
        }}
        title={
          selected ? "ჩანაწერის რედაქტირება" : "დაკვირვების სიაში დამატება"
        }
        description="აქტივის დამატება რეალურ პოზიციას ან ტრანზაქციას არ ქმნის."
      >
        <form
          key={`${open}:${selected?.id ?? "new"}`}
          className="space-y-3 lg:space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            setPending(true);
            try {
              const response = await saveWatchlist({
                portfolioId,
                assetId,
                entryPrice: String(form.get("entryPrice") ?? "").trim() || null,
                exitPrice: String(form.get("exitPrice") ?? "").trim() || null,
                notes: String(form.get("notes") ?? ""),
              });
              if (response.ok) {
                window.dispatchEvent(new Event("ccx-watchlist-changed"));
                setOpen(false);
                router.refresh();
              } else setError(response.error);
            } catch {
              setError("შენახვა ვერ მოხერხდა.");
            } finally {
              setPending(false);
            }
          }}
        >
          <Field label="აქტივი">
            <select
              className="select"
              value={assetId}
              disabled={!!selected}
              onChange={(e) => setAssetId(e.target.value)}
            >
              {options.map((a) => (
                <option value={a.id} key={a.id}>
                  {a.symbol} · {a.name}
                </option>
              ))}
            </select>
          </Field>
          {!selected && (
            <div className="join flex w-full">
              <input
                className="input join-item min-w-0 flex-1"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="აქტივის ძიება"
                placeholder="სხვა აქტივი…"
              />
              <button
                className="btn join-item"
                type="button"
                disabled={pending || query.length < 2}
                aria-label="ძიება"
                onClick={async () => {
                  setPending(true);
                  try {
                    const result = await searchAssets(query);
                    if (result.ok) {
                      setOptions((current) => [
                        ...current,
                        ...result.assets.filter(
                          (a) => !current.some((c) => c.id === a.id),
                        ),
                      ]);
                      if (result.assets[0]) setAssetId(result.assets[0].id);
                      else setError("აქტივი ვერ მოიძებნა.");
                    } else setError(result.error);
                  } catch {
                    setError("ძიება ვერ მოხერხდა.");
                  } finally {
                    setPending(false);
                  }
                }}
              >
                <Search size={16} />
              </button>
            </div>
          )}
          <Field label="შესყიდვის შეტყობინების ფასი (USD)">
            <input
              className="input"
              name="entryPrice"
              inputMode="decimal"
              defaultValue={
                selected?.entryPrice
                  ? decimal(selected.entryPrice).toFixed()
                  : ""
              }
              placeholder="არასავალდებულო"
            />
          </Field>
          <Field label="გაყიდვის შეტყობინების ფასი (USD)">
            <input
              className="input"
              name="exitPrice"
              inputMode="decimal"
              defaultValue={
                selected?.exitPrice ? decimal(selected.exitPrice).toFixed() : ""
              }
              placeholder="არასავალდებულო"
            />
          </Field>
          <p className="text-xs text-base-content/60">
            შესყიდვა: ფასი ≤ სამიზნეს. გაყიდვა: ფასი ≥ სამიზნეს. თითო სამიზნეზე
            ერთი შეტყობინება — შემდეგი გადაკვეთისას. ხელახლა ჩასართავად შეცვალეთ
            სამიზნე ფასი.
          </p>
          <Field label="შენიშვნები">
            <textarea
              className="textarea"
              name="notes"
              rows={3}
              maxLength={5000}
              defaultValue={selected?.notes ?? ""}
            />
          </Field>
          {error && <Message error>{error}</Message>}
          <button
            className="btn btn-primary btn-block"
            disabled={pending}
            aria-busy={pending}
          >
            {pending && <span className="loading loading-spinner loading-xs" />}
            შენახვა
          </button>
        </form>
      </Modal>
      <Modal
        open={deleting !== null}
        onOpenChange={(v) => {
          if (!v) setDeleting(null);
        }}
        title="ჩანაწერის წაშლა"
        description="აქტივი დაკვირვების სიიდან წაიშლება."
      >
        {error && <Message error>{error}</Message>}
        <button
          className="btn btn-error mt-4"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            try {
              const result = await removeWatchlist(portfolioId, deleting!);
              if (result.ok) {
                window.dispatchEvent(new Event("ccx-watchlist-changed"));
                setDeleting(null);
                router.refresh();
              } else setError(result.error);
            } catch {
              setError("წაშლა ვერ მოხერხდა.");
            } finally {
              setPending(false);
            }
          }}
        >
          წაშლა
        </button>
      </Modal>
    </div>
  );
}
