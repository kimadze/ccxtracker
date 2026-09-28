"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Plus, Search, Target, Trash2 } from "lucide-react";
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
    [filterQuery, setFilterQuery] = useState(""),
    [movement, setMovement] = useState<"all" | "up" | "down" | "unpriced">("all"),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const router = useRouter();
  const filteredItems = items.filter((item) => {
    const quote = quotes.find((q) => q.assetId === item.asset.id);
    const matchesText = `${item.asset.name} ${item.asset.symbol}`.toLowerCase().includes(filterQuery.toLowerCase());
    if (!matchesText) return false;
    if (movement === "up") return Number(quote?.change24h ?? 0) > 0;
    if (movement === "down") return Number(quote?.change24h ?? 0) < 0;
    if (movement === "unpriced") return quote?.price === null || quote?.price === undefined;
    return true;
  });
  const pricedItems = items.filter((item) => quotes.some((quote) => quote.assetId === item.asset.id && quote.price !== null));
  const risingItems = items.filter((item) => Number(quotes.find((quote) => quote.assetId === item.asset.id)?.change24h ?? 0) > 0);
  const fallingItems = items.filter((item) => Number(quotes.find((quote) => quote.assetId === item.asset.id)?.change24h ?? 0) < 0);
  return (
    <div className="watchlist-workspace space-y-4">
      {!preview && <section className="watchlist-commandbar">
        <div>
          <span className="watchlist-kicker"><Eye size={14} /> ბაზრის სიგნალები</span>
          <h2>საყურადღებო აქტივები</h2>
          <p>პორტფელისგან დამოუკიდებელი ფასების მოკლე სამუშაო სია.</p>
        </div>
        <button className="button-primary" onClick={() => { setSelected(null); setError(""); setOpen(true); }}>
          <Plus size={16} /> აქტივის დამატება
        </button>
      </section>}
      {!preview && <section className="watchlist-summary" aria-label="დაკვირვების სიის შეჯამება">
        <button className={movement === "all" ? "is-active" : ""} onClick={() => setMovement("all")}><span>სულ აქტივი</span><strong>{items.length}</strong></button>
        <button className={movement === "up" ? "is-active positive" : "positive"} onClick={() => setMovement("up")}><span>დღეს ზრდაში</span><strong>{risingItems.length}</strong></button>
        <button className={movement === "down" ? "is-active negative" : "negative"} onClick={() => setMovement("down")}><span>დღეს კლებაში</span><strong>{fallingItems.length}</strong></button>
        <button className={movement === "unpriced" ? "is-active" : ""} onClick={() => setMovement("unpriced")}><span>ფასის გარეშე</span><strong>{items.length - pricedItems.length}</strong></button>
      </section>}
      {!preview && <div className="watchlist-toolbar">
        <label className="watchlist-search"><Search size={17} /><input value={filterQuery} onChange={(event) => setFilterQuery(event.target.value)} placeholder="მოძებნეთ აქტივი ან სიმბოლო…" /></label>
        <span>{filteredItems.length} აქტივი</span>
      </div>}
      <div className="watchlist-items">
        <div className="watchlist-list-head" aria-hidden="true"><span>აქტივი</span><span>მიმდინარე ფასი</span><span>სასურველი შესვლა</span><span /></div>
        {filteredItems.map((item, i) => {
          const quote = quotes.find((q) => q.assetId === item.asset.id);
          const currentPrice = Number(quote?.price ?? NaN);
          const targetPrice = Number(item.entryPrice ?? NaN);
          const targetGap = Number.isFinite(currentPrice) && Number.isFinite(targetPrice) && targetPrice !== 0
            ? String(((currentPrice - targetPrice) / targetPrice) * 100) : null;
          return (
            <div
              key={item.id}
              className="watchlist-row"
            >
              <div className="watchlist-asset">
                <AssetIcon symbol={item.asset.symbol} logoUrl={item.asset.logoUrl} index={i} />
                <div>
                  <p>{item.asset.name} <span>{item.asset.symbol}</span></p>
                  <small>დამატებულია {dateTime(item.createdAt, true)}</small>
                  {item.notes && (
                    <small className="watchlist-note">{item.notes}</small>
                  )}
                </div>
              </div>
              <div className="watchlist-price"><span>მიმდინარე ფასი</span><strong>{money(quote?.price ?? null)}</strong><small className={pnlClass(quote?.change24h === null || quote?.change24h === undefined ? null : String(quote.change24h))}>
                    {percentage(quote?.change24h === null || quote?.change24h === undefined ? null : String(quote.change24h), true)}
                    {quote?.stale ? " · მოძველებულია" : ""}
              </small></div>
              <div className="watchlist-target"><span><Target size={13} /> სასურველი შესვლა</span><strong>{money(item.entryPrice)}</strong><small className={pnlClass(targetGap)}>{targetGap === null ? "ფასი არ არის მითითებული" : `${percentage(targetGap, true)} შესვლის ფასიდან`}</small></div>
              {!preview && <div className="watchlist-actions">
                <button aria-label={`${item.asset.symbol} რედაქტირება`} onClick={() => { setSelected(item); setAssetId(item.asset.id); setError(""); setOpen(true); }}><Pencil size={15} /></button>
                <button className="danger" aria-label={`${item.asset.symbol} წაშლა`} onClick={() => { setDeleting(item.id); setError(""); }}><Trash2 size={15} /></button>
              </div>}
            </div>
          );
        })}
        {!filteredItems.length && (
          <div className="watchlist-empty">
            <Eye size={22} />
            <h2>{items.length ? "აქტივი ვერ მოიძებნა" : "დაკვირვების სია ჯერ ცარიელია"}</h2>
            <p>{items.length ? "შეცვალეთ ძიება ან სტატუსის ფილტრი." : "დაამატეთ აქტივები, რომელთა ფასსაც აკვირდებით. ისინი პორტფელის ღირებულებაში არ ჩაითვლება."}</p>
            {!items.length && !preview && <button className="button-secondary" onClick={() => setOpen(true)}><Plus size={15} /> პირველი აქტივის დამატება</button>}
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
