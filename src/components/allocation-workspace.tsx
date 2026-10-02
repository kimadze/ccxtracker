"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Save, SlidersHorizontal } from "lucide-react";
import type { Asset, PortfolioSummary, Quote } from "@/domain/types";
import { calculateDeployment, validateWeights } from "@/domain/allocation";
import { decimal } from "@/domain/decimal";
import {
  isInvestableCrypto,
  investableAllocation,
  investablePositions,
  investableValue,
} from "@/domain/portfolio-segments";
import { inputNumber, money, percentage, pnlClass } from "@/lib/formatters";
import { saveAllocation } from "@/server/allocation-actions";
import { AssetIcon } from "./positions";
import { Message } from "./ui";
import { TransactionForm } from "./transaction-form";

export function AllocationWorkspace({
  summary,
  assets,
  quotes,
  portfolioId,
  revision,
  initial,
  preview = false,
}: {
  summary: PortfolioSummary;
  assets: Asset[];
  quotes: Quote[];
  portfolioId: string;
  revision: number;
  initial: { assetId: string; weight: string }[];
  preview?: boolean;
}) {
  const cryptoAssets = useMemo(
    () => assets.filter(isInvestableCrypto),
    [assets],
  );
  const cryptoPositions = useMemo(
    () => investablePositions(summary),
    [summary],
  );
  const ids = useMemo(
    () => [
      ...new Set([
        ...cryptoPositions.map((p) => p.assetId),
        ...initial
          .filter((r) => cryptoAssets.some((asset) => asset.id === r.assetId))
          .map((r) => r.assetId),
      ]),
    ],
    [cryptoPositions, initial, cryptoAssets],
  );
  const [weights, setWeights] = useState<Record<string, string>>(() =>
      Object.fromEntries(
        ids.map((id) => [
          id,
          initial.find((r) => r.assetId === id)?.weight ?? "0",
        ]),
      ),
    ),
    [showAllRows, setShowAllRows] = useState(false);
  const [capital, setCapital] = useState(""),
    [addId, setAddId] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false),
    [pending, setPending] = useState(false);
  const asset = (id: string) => assets.find((a) => a.id === id);
  const symbol = (id: string) =>
    id === "USD" ? "USD" : (asset(id)?.symbol ?? id);
  const displayNumber = (value: string) =>
    value === "" ? "" : inputNumber(value);
  const rows = Object.entries(weights).map(([assetId, weight]) => ({
    assetId,
    weight: weight || "0",
    value: cryptoPositions.find((p) => p.assetId === assetId)?.value ?? "0",
    price: quotes.find((q) => q.assetId === assetId)?.price ?? null,
  }));
  const total = rows.reduce((sum, row) => sum.plus(row.weight), decimal(0));
  let valid = false;
  let result: ReturnType<typeof calculateDeployment> | null = null;
  try {
    validateWeights(rows);
    valid = true;
    if (summary.complete && capital !== "")
      result = calculateDeployment(rows, capital);
  } catch {
    /* an editable draft is valid UI state */
  }
  const cryptoValue = investableValue(summary);
  const currentWeight = (id: string) =>
    investableAllocation(
      cryptoPositions.find((p) => p.assetId === id)?.value ?? null,
      cryptoValue,
    );
  const save = async () => {
    setPending(true);
    try {
      const response = await saveAllocation({
        portfolioId,
        rows: rows.map(({ assetId, weight }) => ({ assetId, weight })),
      });
      setError(!response.ok);
      setMessage(response.ok ? "განაწილება შენახულია." : response.error);
    } catch {
      setError(true);
      setMessage("შენახვა ვერ მოხერხდა.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-3 lg:space-y-4">
      <section
        className="card card-border bg-base-200"
        aria-label="მიზნობრივი განაწილება"
      >
        <div className="card-body gap-3 p-4">
          <div>
            <h2 className="card-title">კრიპტოაქტივების განაწილება</h2>
            <small className="text-base-content/60">
              {valid ? "მიზნები მზადაა" : "წონები უნდა უდრიდეს 100%-ს"}
            </small>
          </div>
          <div className="grid grid-cols-2 bg-base-100">
            <span className="stat min-w-0 p-3">
              <small className="stat-title">სულ წილი</small>
              <strong className="stat-value text-2xl">
                {inputNumber(total.toFixed())}%
              </strong>
            </span>
            <span className="stat min-w-0 p-3">
              <small className="stat-title">აქტიური კრიპტო</small>
              <strong className="stat-value text-2xl">
                {cryptoPositions.length}
              </strong>
            </span>
          </div>
          <div className="flex h-3 overflow-hidden rounded-box bg-base-100">
            {rows
              .filter((row) => decimal(row.weight).gt(0))
              .map((row, index) => (
                <span
                  key={row.assetId}
                  className="flex min-w-0 flex-col items-center justify-center border-r border-base-300 bg-primary/20 px-2 text-xs last:border-0"
                  style={{
                    flexGrow: Number(row.weight),
                    opacity: Math.max(0.45, 1 - index * 0.045),
                  }}
                >
                  <b className="sr-only">{symbol(row.assetId)}</b>
                  <small className="sr-only">{inputNumber(row.weight)}%</small>
                </span>
              ))}
          </div>
        </div>
      </section>

      <div className="grid gap-3 lg:gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(260px,3fr)]">
        <section className="card card-border overflow-hidden bg-base-200">
          <header className="flex items-center justify-between border-b border-base-300 p-5">
            <div>
              <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary">
                <SlidersHorizontal size={13} /> სამიზნეები
              </p>
              <h2 className="mt-1 font-semibold">მიზნობრივი განაწილება</h2>
            </div>
          </header>
          <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 border-b border-base-300 px-5 py-3 text-xs text-base-content/50 lg:grid">
            <span>აქტივი</span>
            <span>სამიზნე წილი</span>
            <span>მიმდინარე წილი</span>
            <span>გადახრა</span>
            <span>ღირებულება</span>
          </div>
          <div className="divide-y divide-base-300">
            {rows.map((row, index) => {
              const current = currentWeight(row.assetId);
              const deviation =
                current === null
                  ? null
                  : decimal(current).minus(row.weight).toFixed();
              return (
                <div
                  className={`grid grid-cols-2 gap-2 p-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:px-5 ${index > 5 && !showAllRows ? "hidden lg:grid" : ""}`}
                  key={row.assetId}
                >
                  <Link
                    className="col-span-2 flex min-w-0 items-center gap-3 lg:col-span-1"
                    href={`/portfolios/${portfolioId}/strategy?asset=${encodeURIComponent(row.assetId)}`}
                  >
                    <AssetIcon
                      symbol={symbol(row.assetId)}
                      logoUrl={asset(row.assetId)?.logoUrl}
                      index={index}
                    />
                    <span className="min-w-0">
                      <strong className="block">{symbol(row.assetId)}</strong>
                      <small className="block truncate text-base-content/50">
                        {asset(row.assetId)?.name} · გეგმის გახსნა ↗
                      </small>
                    </span>
                  </Link>
                  <label className="input min-h-11 w-full min-w-0">
                    <input
                      aria-label={`${symbol(row.assetId)} სამიზნე წილი`}
                      inputMode="decimal"
                      value={displayNumber(row.weight)}
                      onChange={(event) => {
                        setWeights((w) => ({
                          ...w,
                          [row.assetId]: event.target.value,
                        }));
                        setMessage("");
                      }}
                    />
                    <span>%</span>
                  </label>
                  <span className="text-sm">
                    <small className="mr-2 text-base-content/40 lg:hidden">
                      მიმდინარე
                    </small>
                    {percentage(current)}
                  </span>
                  <span className={`text-right ${pnlClass(deviation)}`}>
                    {percentage(deviation, true)}
                  </span>
                  <strong className="numeric whitespace-nowrap text-right">
                    {money(row.value)}
                  </strong>
                </div>
              );
            })}
          </div>
          {rows.length > 6 && (
            <button
              type="button"
              className="btn btn-block rounded-none lg:hidden"
              onClick={() => setShowAllRows((open) => !open)}
            >
              {showAllRows
                ? "ნაკლების ნახვა"
                : `კიდევ ${rows.length - 6} აქტივის რედაქტირება`}
            </button>
          )}
          <div className="flex flex-wrap gap-2 border-t border-base-300 p-3">
            <select
              className="select min-w-0 flex-1"
              aria-label="აქტივის დამატება"
              value={addId}
              onChange={(event) => setAddId(event.target.value)}
            >
              <option value="">აქტივის დამატება…</option>
              {cryptoAssets
                .filter((item) => !(item.id in weights))
                .map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.symbol} · {item.name}
                  </option>
                ))}
            </select>
            <button
              className="btn"
              disabled={!addId}
              onClick={() => {
                setWeights((w) => ({ ...w, [addId]: "0" }));
                setAddId("");
              }}
            >
              <Plus size={14} /> დამატება
            </button>
            {!preview && (
              <button
                className="btn btn-primary"
                disabled={!valid || pending}
                onClick={save}
              >
                <Save size={14} />
                {pending ? "ინახება…" : "შენახვა"}
              </button>
            )}
          </div>
        </section>

        <aside className="space-y-3 lg:space-y-4">
          <section className="card card-border bg-base-200">
            <div className="card-body min-w-0 gap-3 p-4">
              <header>
                <h2 className="card-title text-base">კონცენტრაცია</h2>
                <span className="text-xs text-base-content/50">
                  არასტეიბლ კრიპტო
                </span>
              </header>
              {[3, 5].map((count) => {
                const value = [...rows]
                  .sort((a, b) => Number(b.value) - Number(a.value))
                  .slice(0, count)
                  .reduce((sum, row) => sum.plus(row.value), decimal(0));
                const share =
                  cryptoValue !== null && decimal(cryptoValue).gt(0)
                    ? value.div(cryptoValue).mul(100).toFixed()
                    : "0";
                return (
                  <div
                    className="grid grid-cols-[3rem_1fr_auto] items-center gap-3"
                    key={count}
                  >
                    <span className="text-xs">Top {count}</span>
                    <progress
                      className="progress progress-primary"
                      value={Math.min(100, Number(share))}
                      max="100"
                    />
                    <strong className="numeric text-sm">
                      {percentage(share)}
                    </strong>
                  </div>
                );
              })}
            </div>
          </section>
          <section className="card card-border bg-base-200">
            <div className="card-body min-w-0 gap-3 p-4">
              <header>
                <div>
                  <h2 className="card-title text-base">ახალი კაპიტალი</h2>
                </div>
              </header>
              <fieldset className="fieldset">
                <legend className="fieldset-legend">დასამატებელი თანხა</legend>
                <label className="input">
                  <b>$</b>
                  <input
                    inputMode="decimal"
                    value={capital}
                    placeholder="0"
                    onChange={(event) => setCapital(event.target.value)}
                  />
                </label>
              </fieldset>
              {result ? (
                <div className="space-y-2">
                  <p className="text-xs text-base-content/60">
                    რეკომენდებული შესყიდვები
                  </p>
                  {result.rows
                    .filter((row) => decimal(row.capital).gt(0))
                    .slice(0, 5)
                    .map((row, index) => (
                      <div
                        className="flex items-center justify-between gap-2 rounded-box bg-base-100 p-3"
                        key={row.assetId}
                      >
                        <span className="flex items-center gap-2">
                          <AssetIcon
                            symbol={symbol(row.assetId)}
                            logoUrl={asset(row.assetId)?.logoUrl}
                            index={index}
                          />
                          <strong>{symbol(row.assetId)}</strong>
                        </span>
                        <strong className="numeric text-primary">
                          {money(row.capital)}
                        </strong>
                        {!preview && (
                          <TransactionForm
                            portfolioId={portfolioId}
                            revision={revision}
                            assets={assets}
                            initialAsset={row.assetId}
                            triggerLabel="ყიდვა"
                          />
                        )}
                      </div>
                    ))}
                </div>
              ) : (
                <div
                  role="alert"
                  className="alert alert-info alert-soft text-xs leading-6"
                >
                  შეიყვანეთ თანხა, რომ გამოჩნდეს მიზნობრივ წონებამდე საჭირო
                  შესყიდვები.
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
      {message && <Message error={error}>{message}</Message>}
    </div>
  );
}
