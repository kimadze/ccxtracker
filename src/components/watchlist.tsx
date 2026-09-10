"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import type { Asset, Quote } from "@/domain/types";
import { saveWatchlist, removeWatchlist } from "@/server/settings-actions";
import { searchAssets } from "@/server/actions";
import { money, dateTime, percentage, pnlClass } from "@/lib/formatters";
import { AssetIcon } from "./positions";
import { Field, Message, Modal } from "./ui";
export interface WatchItem {
  id: string;
  asset: Asset;
  entryPrice: string | null;
  notes: string;
  createdAt: string;
}
export function Watchlist({
  portfolioId,
  assets,
  items,
  quotes,
  preview = false,
}: {
  portfolioId: string;
  assets: Asset[];
  items: WatchItem[];
  quotes: Quote[];
  preview?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [selected, setSelected] = useState<WatchItem | null>(null),
    [deleting, setDeleting] = useState<string | null>(null),
    [options, setOptions] = useState(assets.filter((a) => a.id !== "USD")),
    [assetId, setAssetId] = useState(
      assets.find((a) => a.id !== "USD")?.id ?? "",
    ),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const router = useRouter();
  return (
    <div className="space-y-6">
      {!preview && (
        <button
          className="button-primary"
          onClick={() => {
            setSelected(null);
            setError("");
            setOpen(true);
          }}
        >
          <Plus size={16} />
          აქტივის დამატება
        </button>
      )}
      <div className="panel divide-y divide-line">
        {items.map((item, i) => {
          const quote = quotes.find((q) => q.assetId === item.asset.id);
          return (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-5 p-6"
            >
              <div className="flex items-center gap-3">
                <AssetIcon symbol={item.asset.symbol} index={i} />
                <div>
                  <p className="text-sm font-medium">
                    {item.asset.name}{" "}
                    <span className="ml-2 text-xs text-muted">
                      {item.asset.symbol}
                    </span>
                  </p>
                  <p className="mt-1.5 text-[10px] text-muted">
                    დამატებულია {dateTime(item.createdAt, true)}
                  </p>
                  {item.notes && (
                    <p className="mt-3 max-w-sm break-words text-xs text-muted">
                      {item.notes}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="text-[10px] text-muted">მიმდინარე ფასი</p>
                  <p className="numeric mt-1 text-sm">
                    {money(quote?.price ?? null)}
                  </p>
                  <p
                    className={`mt-1 text-[10px] ${pnlClass(quote?.change24h ?? null)}`}
                  >
                    {percentage(quote?.change24h ?? null, true)}
                    {quote?.stale ? " · მოძველებულია" : ""}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted">
                    სასურველი შესვლის ფასი
                  </p>
                  <p className="numeric mt-1 text-sm">
                    {money(item.entryPrice)}
                  </p>
                </div>
                {!preview && (
                  <div className="flex flex-col gap-2">
                    <button
                      className="text-xs text-brand"
                      onClick={() => {
                        setSelected(item);
                        setAssetId(item.asset.id);
                        setError("");
                        setOpen(true);
                      }}
                    >
                      რედაქტირება
                    </button>
                    <button
                      className="text-xs text-negative"
                      onClick={() => {
                        setDeleting(item.id);
                        setError("");
                      }}
                    >
                      წაშლა
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {!items.length && (
          <div className="px-6 py-20 text-center">
            <h2 className="text-sm font-medium">დაკვირვების სია ცარიელია</h2>
            <p className="mt-3 text-xs leading-6 text-muted">
              შეინახეთ აქტივები, რომელთა ფასსაც აკვირდებით. ისინი პორტფელის
              ღირებულებაში არ ჩაითვლება.
            </p>
          </div>
        )}
      </div>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={
          selected ? "ჩანაწერის რედაქტირება" : "დაკვირვების სიაში დამატება"
        }
        description="აქტივის დამატება რეალურ პოზიციას ან ტრანზაქციას არ ქმნის."
      >
        <form
          className="space-y-5"
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
            <div className="flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="აქტივის ძიება"
                placeholder="სხვა აქტივი…"
              />
              <button
                className="button-secondary"
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
              name="entryPrice"
              inputMode="decimal"
              defaultValue={selected?.entryPrice ?? ""}
              placeholder="არასავალდებულო"
            />
          </Field>
          <Field label="შენიშვნები">
            <textarea
              name="notes"
              rows={3}
              maxLength={5000}
              defaultValue={selected?.notes ?? ""}
            />
          </Field>
          {error && <Message error>{error}</Message>}
          <button className="button-primary" disabled={pending}>
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
          className="button-danger mt-4"
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
