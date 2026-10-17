"use client";

import { useId, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import type { Asset } from "@/domain/types";
import { searchAssets } from "@/server/actions";
import { assetSelection } from "@/lib/asset-selection";
import { AssetIcon } from "./positions";

export function AssetPicker({
  assets,
  value,
  onChange,
  onDiscover,
  preferredIds = [],
  label = "აქტივი",
  disabled = false,
}: {
  assets: Asset[];
  value: string;
  onChange: (id: string) => void;
  onDiscover: (assets: Asset[]) => void;
  preferredIds?: readonly string[];
  label?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const request = useRef(0);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<Asset[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = assets.find((asset) => asset.id === value);
  const matches = assetSelection(assets, query, preferredIds);
  const results = remote ?? matches.slice(0, 6);
  const close = () => {
    request.current++;
    setOpen(false);
    setBusy(false);
    trigger.current?.focus();
  };
  return (
    <div
      className="fieldset min-w-0"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}
    >
      <label className="fieldset-legend" htmlFor={id}>
        {label}
      </label>
      <button
        ref={trigger}
        id={id}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={`${id}-results`}
        disabled={disabled}
        className="btn min-h-12 w-full justify-start gap-3 border-base-300 bg-base-100 px-3 font-normal"
        onClick={() => {
          if (open) close();
          else {
            setQuery("");
            setRemote(null);
            setError("");
            setOpen(true);
          }
        }}
      >
        {selected && (
          <AssetIcon
            key={selected.id}
            symbol={selected.symbol}
            logoUrl={selected.logoUrl}
            size={28}
          />
        )}
        <span className="min-w-0 flex-1 truncate text-left">
          <span className="font-semibold">
            {selected?.symbol ?? "აირჩიეთ აქტივი"}
          </span>
          {selected && (
            <span className="ml-2 text-xs text-base-content/60">
              {selected.name}
            </span>
          )}
        </span>
        <ChevronDown
          size={16}
          className="shrink-0 text-base-content/60"
          aria-hidden="true"
        />
      </button>
      {open && (
        <section
          id={`${id}-results`}
          aria-label={`${label} — არჩევა`}
          className="rounded-box border border-base-300 bg-base-100 p-2"
        >
          <div className="flex gap-1">
            <label className="input flex min-h-11 min-w-0 flex-1 items-center gap-2">
              <Search
                size={16}
                className="shrink-0 text-base-content/60"
                aria-hidden="true"
              />
              <input
                autoFocus
                aria-label={`${label} — ძიება`}
                placeholder="სიმბოლო ან მონეტის სახელი"
                value={query}
                className="min-w-0 text-base md:text-sm"
                onChange={(event) => {
                  request.current++;
                  setQuery(event.target.value);
                  setRemote(null);
                  setError("");
                  setBusy(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    event.currentTarget
                      .closest("section")
                      ?.querySelector<HTMLButtonElement>("[data-asset-result]")
                      ?.focus();
                  }
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    event.currentTarget
                      .closest("section")
                      ?.querySelector<HTMLButtonElement>("[data-asset-result]")
                      ?.focus();
                  }
                }}
              />
            </label>
            <button
              type="button"
              className="btn btn-ghost btn-square min-h-11"
              aria-label="არჩევის დახურვა"
              onClick={close}
            >
              <X size={16} />
            </button>
          </div>
          <p className="px-2 pt-2 text-xs text-base-content/60">
            {remote
              ? "ძიების შედეგები"
              : query.trim()
                ? "ნაპოვნი აქტივები"
                : preferredIds.length
                  ? "თქვენი აქტივები და პოპულარული"
                  : "პოპულარული აქტივები"}
          </p>
          <ul
            className="list max-h-64 overflow-y-auto overscroll-contain"
            aria-label="მონეტები"
          >
            {results.map((asset) => (
              <li key={asset.id}>
                <button
                  type="button"
                  data-asset-result={asset.id}
                  aria-pressed={value === asset.id}
                  aria-label={`${asset.symbol} · ${asset.name} · ${asset.id}`}
                  className={`list-row min-h-12 w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-field px-2 py-2 text-left hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-primary ${value === asset.id ? "bg-primary/10" : ""}`}
                  onClick={() => {
                    onDiscover([asset]);
                    onChange(asset.id);
                    close();
                  }}
                >
                  <AssetIcon
                    key={asset.id}
                    symbol={asset.symbol}
                    logoUrl={asset.logoUrl}
                    size={28}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {asset.symbol}{" "}
                      <span className="font-normal text-base-content/60">
                        {asset.name}
                      </span>
                    </span>
                    <span className="block truncate text-[11px] text-base-content/50">
                      {asset.id}
                    </span>
                  </span>
                  {value === asset.id && (
                    <Check
                      size={16}
                      className="text-primary"
                      aria-hidden="true"
                    />
                  )}
                </button>
              </li>
            ))}
          </ul>
          {!results.length && (
            <p role="status" className="px-2 py-3 text-xs text-base-content/60">
              აქტივი ვერ მოიძებნა.
            </p>
          )}
          {query.trim().length >= 2 && (
            <button
              type="button"
              className="btn btn-ghost min-h-11 w-full text-xs"
              disabled={busy}
              onClick={async () => {
                const version = ++request.current;
                setBusy(true);
                setError("");
                try {
                  const reply = await searchAssets(query.trim());
                  if (version !== request.current) return;
                  if (reply.ok) setRemote(reply.assets);
                  else setError(reply.error);
                } catch {
                  if (version === request.current)
                    setError("ძიება ვერ მოხერხდა. სცადეთ ხელახლა.");
                } finally {
                  if (version === request.current) setBusy(false);
                }
              }}
            >
              {busy ? "ძიება…" : "მოძებნე CoinGecko-ზე"}
            </button>
          )}
          {remote === null && matches.length > 6 && query.trim() && (
            <p className="px-2 py-1 text-xs text-base-content/60">
              კიდევ {matches.length - 6} · დააზუსტეთ ძიება
            </p>
          )}
          {error && (
            <p role="alert" className="px-2 py-1 text-xs text-error">
              {error}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
