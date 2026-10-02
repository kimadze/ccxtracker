"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Plus, Search, Target, Trash2 } from "lucide-react";
import type { Asset, Quote } from "@/domain/types";
import { saveWatchlist, removeWatchlist } from "@/server/settings-actions";
import { searchAssets } from "@/server/actions";
import { money, dateTime, percentage, pnlClass, unitPrice } from "@/lib/formatters";
import { AssetIcon } from "./positions";
import { BalanceValue, Field, Message, Modal } from "./ui";
export interface WatchItem {
  id: string;
  asset: Asset;
  entryPrice: string | null;
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
    [deleting, setDeleting] = useState<string | null>(null),
    [options, setOptions] = useState(assets.filter((a) => a.id !== "USD")),
    [assetId, setAssetId] = useState(
      assets.find((a) => a.id !== "USD")?.id ?? "",
    ),
    [filterQuery, setFilterQuery] = useState(""),
    [movement, setMovement] = useState<"all" | "up" | "down" | "unpriced">(
      "all",
    ),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const router = useRouter();
  const filteredItems = items.filter((item) => {
    const quote = quotes.find((q) => q.assetId === item.asset.id);
    const matchesText = `${item.asset.name} ${item.asset.symbol}`
      .toLowerCase()
      .includes(filterQuery.toLowerCase());
    if (!matchesText) return false;
    if (movement === "up") return Number(quote?.change24h ?? 0) > 0;
    if (movement === "down") return Number(quote?.change24h ?? 0) < 0;
    if (movement === "unpriced")
      return quote?.price === null || quote?.price === undefined;
    return true;
  });
  const pricedItems = items.filter((item) =>
    quotes.some(
      (quote) => quote.assetId === item.asset.id && quote.price !== null,
    ),
  );
  const risingItems = items.filter(
    (item) =>
      Number(
        quotes.find((quote) => quote.assetId === item.asset.id)?.change24h ?? 0,
      ) > 0,
  );
  const fallingItems = items.filter(
    (item) =>
      Number(
        quotes.find((quote) => quote.assetId === item.asset.id)?.change24h ?? 0,
      ) < 0,
  );
  return (
    <div className="space-y-3 lg:space-y-4">
      {!preview && (
        <div className="flex justify-end">
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
        </div>
      )}
      {!preview && (
        <section
          className="grid grid-cols-2 gap-2 lg:grid-cols-4"
          aria-label="დაკვირვების სიის შეჯამება"
        >
          <button
            aria-pressed={movement === "all"}
            className={`btn min-h-11 justify-between text-xs ${movement === "all" ? "btn-active" : "btn-ghost"}`}
            onClick={() => setMovement("all")}
          >
            <span>სულ აქტივი</span>
            <strong className="tabular-nums">{items.length}</strong>
          </button>
          <button
            aria-pressed={movement === "up"}
            className={`btn min-h-11 justify-between text-xs ${movement === "up" ? "btn-active" : "btn-ghost"}`}
            onClick={() => setMovement("up")}
          >
            <span>დღეს ზრდაში</span>
            <strong className="tabular-nums">{risingItems.length}</strong>
          </button>
          <button
            aria-pressed={movement === "down"}
            className={`btn min-h-11 justify-between text-xs ${movement === "down" ? "btn-active" : "btn-ghost"}`}
            onClick={() => setMovement("down")}
          >
            <span>დღეს კლებაში</span>
            <strong className="tabular-nums">{fallingItems.length}</strong>
          </button>
          <button
            aria-pressed={movement === "unpriced"}
            className={`btn min-h-11 justify-between text-xs ${movement === "unpriced" ? "btn-active" : "btn-ghost"}`}
            onClick={() => setMovement("unpriced")}
          >
            <span>ფასის გარეშე</span>
            <strong className="tabular-nums">
              {items.length - pricedItems.length}
            </strong>
          </button>
        </section>
      )}
      {!preview && (
        <div className="flex min-w-0 items-center gap-3">
          <label className="input min-h-11 min-w-0 flex-1">
            <Search size={17} />
            <input
              value={filterQuery}
              onChange={(event) => setFilterQuery(event.target.value)}
              aria-label="დაკვირვების სიის ძიება"
              placeholder="მოძებნეთ აქტივი ან სიმბოლო…"
            />
          </label>
          <span className="shrink-0 text-xs text-base-content/60">
            {filteredItems.length} აქტივი
          </span>
        </div>
      )}
      <ul className="list rounded-box border border-base-300 bg-base-200">
        {filteredItems.map((item, i) => {
          const quote = quotes.find((q) => q.assetId === item.asset.id);
          const currentPrice = Number(quote?.price ?? NaN);
          const targetPrice = Number(item.entryPrice ?? NaN);
          const targetGap =
            Number.isFinite(currentPrice) &&
            Number.isFinite(targetPrice) &&
            targetPrice !== 0
              ? String(((currentPrice - targetPrice) / targetPrice) * 100)
              : null;
          const closeToTarget =
            targetGap !== null && Math.abs(Number(targetGap)) <= 5;
          return (
            <li
              key={item.id}
              className="list-row grid-cols-2 gap-3 border-b border-base-300 p-3 last:border-0 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
            >
              <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-3">
                <AssetIcon
                  symbol={item.asset.symbol}
                  logoUrl={item.asset.logoUrl}
                  index={i}
                />
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {item.asset.name}{" "}
                    <span className="badge badge-sm ml-1">
                      {item.asset.symbol}
                    </span>
                  </p>
                  <small className="block text-base-content/50">
                    დამატებულია {dateTime(item.createdAt, true)}
                  </small>
                  {item.notes && (
                    <small className="mt-1 block max-w-md truncate text-base-content/60">
                      {item.notes}
                    </small>
                  )}
                </div>
              </div>
              <div className="col-start-1 row-start-2 min-w-0 text-left lg:col-start-2 lg:row-start-1 lg:text-right">
                <span className="text-xs text-base-content/50">
                  მიმდინარე ფასი
                </span>
                <strong className="numeric block whitespace-nowrap">
                  {unitPrice(quote?.price ?? null)}
                </strong>
                <small
                  className={pnlClass(
                    quote?.change24h === null || quote?.change24h === undefined
                      ? null
                      : String(quote.change24h),
                  )}
                >
                  {percentage(
                    quote?.change24h === null || quote?.change24h === undefined
                      ? null
                      : String(quote.change24h),
                    true,
                  )}
                  {quote?.stale ? " · მოძველებულია" : ""}
                </small>
              </div>
              <div className="col-start-2 row-start-2 min-w-0 text-right lg:col-start-3 lg:row-start-1">
                <span className="flex items-center justify-end gap-1 text-xs text-base-content/50">
                  <Target size={13} /> სასურველი შესვლა
                </span>
                <strong className="numeric block whitespace-nowrap">
                  <BalanceValue>{unitPrice(item.entryPrice)}</BalanceValue>
                </strong>
                <small
                  className={
                    closeToTarget ? "text-warning" : pnlClass(targetGap)
                  }
                >
                  {targetGap === null
                    ? "ფასი არ არის მითითებული"
                    : closeToTarget
                      ? "შესვლის ფასთან ახლოსაა"
                      : `${percentage(targetGap, true)} შესვლის ფასიდან`}
                </small>
              </div>
              {!preview && (
                <div className="col-start-2 row-start-1 flex justify-end gap-1 lg:col-start-4">
                  <button
                    className="btn btn-ghost btn-square min-h-11 min-w-11"
                    aria-label={`${item.asset.symbol} რედაქტირება`}
                    onClick={() => {
                      setSelected(item);
                      setAssetId(item.asset.id);
                      setError("");
                      setOpen(true);
                    }}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="btn btn-ghost btn-square min-h-11 min-w-11 text-error"
                    aria-label={`${item.asset.symbol} წაშლა`}
                    onClick={() => {
                      setDeleting(item.id);
                      setError("");
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </li>
          );
        })}
        {!filteredItems.length && (
          <li className="flex flex-col items-center px-6 py-6 text-center">
            <Eye size={22} />
            <h2 className="mt-3 font-semibold">
              {items.length
                ? "აქტივი ვერ მოიძებნა"
                : "დაკვირვების სია ჯერ ცარიელია"}
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-base-content/60">
              {items.length
                ? "შეცვალეთ ძიება ან სტატუსის ფილტრი."
                : "დაამატეთ აქტივები, რომელთა ფასსაც აკვირდებით. ისინი პორტფელის ღირებულებაში არ ჩაითვლება."}
            </p>
            {!items.length && !preview && (
              <button className="btn mt-4" onClick={() => setOpen(true)}>
                <Plus size={15} /> პირველი აქტივის დამატება
              </button>
            )}
          </li>
        )}
      </ul>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={
          selected ? "ჩანაწერის რედაქტირება" : "დაკვირვების სიაში დამატება"
        }
        description="აქტივის დამატება რეალურ პოზიციას ან ტრანზაქციას არ ქმნის."
      >
        <form
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
                notes: String(form.get("notes") ?? ""),
              });
              if (response.ok) {
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
          <Field label="სასურველი შესვლის ფასი (USD)">
            <input
              className="input"
              name="entryPrice"
              inputMode="decimal"
              defaultValue={selected?.entryPrice ?? ""}
              placeholder="არასავალდებულო"
            />
          </Field>
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
          <button className="btn btn-primary btn-block" disabled={pending}>
            {pending && <span className="loading loading-spinner loading-xs" />}
            {pending ? "ინახება…" : "შენახვა"}
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
