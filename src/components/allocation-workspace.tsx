"use client";
import { useState } from "react";
import type { Asset, PortfolioSummary, Quote } from "@/domain/types";
import { calculateDeployment, validateWeights } from "@/domain/allocation";
import { decimal } from "@/domain/decimal";
import { money, percentage, quantity } from "@/lib/formatters";
import { saveAllocation } from "@/server/allocation-actions";
import { Field, Message } from "./ui";
import { Metric } from "./overview";
export function AllocationWorkspace({
  summary,
  assets,
  quotes,
  portfolioId,
  initial,
  preview = false,
}: {
  summary: PortfolioSummary;
  assets: Asset[];
  quotes: Quote[];
  portfolioId: string;
  initial: { assetId: string; weight: string }[];
  preview?: boolean;
}) {
  const ids = [
    ...new Set([
      "USD",
      ...summary.positions.map((p) => p.assetId),
      ...initial.map((r) => r.assetId),
    ]),
  ];
  const [weights, setWeights] = useState<Record<string, string>>(
    Object.fromEntries(
      ids.map((id) => [
        id,
        initial.find((r) => r.assetId === id)?.weight ?? "0",
      ]),
    ),
  );
  const [capital, setCapital] = useState("0"),
    [custom, setCustom] = useState<Record<string, string>>({}),
    [mode, setMode] = useState("target"),
    [addId, setAddId] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false),
    [pending, setPending] = useState(false);
  const rows = Object.entries(weights).map(([assetId, weight]) => ({
    assetId,
    weight: weight || "0",
    value:
      assetId === "USD"
        ? summary.cash
        : (summary.positions.find((p) => p.assetId === assetId)?.value ?? "0"),
    price:
      assetId === "USD"
        ? "1"
        : (quotes.find((q) => q.assetId === assetId)?.price ?? null),
  }));
  let validWeights = false,
    result: ReturnType<typeof calculateDeployment> | null = null,
    totalWeight = "—";
  try {
    totalWeight = rows.reduce((s, r) => s.plus(r.weight), decimal(0)).toFixed();
    validateWeights(rows);
    validWeights = true;
    if (summary.complete)
      result = calculateDeployment(
        rows,
        capital || "0",
        mode === "custom" ? custom : undefined,
      );
  } catch {
    /* Drafts do not produce misleading suggestions. */
  }
  const symbol = (id: string) =>
    id === "USD" ? "USD" : (assets.find((a) => a.id === id)?.symbol ?? id);
  return (
    <div className="space-y-6">
      <section className="panel p-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium">მიზნობრივი განაწილება</h2>
            <p className="mt-2 text-xs text-muted">
              განსაზღვრეთ თითოეული აქტივისა და თანხის ნაშთის სასურველი წილი.
            </p>
          </div>
          <span
            className={`rounded-lg border px-3 py-2 text-xs ${validWeights ? "border-brand/30 text-brand" : "border-line text-muted"}`}
          >
            {totalWeight}% / 100%
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <Field
              key={r.assetId}
              label={`${symbol(r.assetId)} — მიზნობრივი წილი (%)`}
            >
              <input
                inputMode="decimal"
                value={weights[r.assetId]}
                onChange={(e) => {
                  setWeights((w) => ({ ...w, [r.assetId]: e.target.value }));
                  setMessage("");
                }}
              />
            </Field>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <select
            className="max-w-xs"
            aria-label="განაწილებაში აქტივის დამატება"
            value={addId}
            onChange={(e) => setAddId(e.target.value)}
          >
            <option value="">სხვა აქტივი…</option>
            {assets
              .filter((a) => !(a.id in weights))
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.symbol} · {a.name}
                </option>
              ))}
          </select>
          <button
            className="button-secondary"
            disabled={!addId}
            onClick={() => {
              setWeights((w) => ({ ...w, [addId]: "0" }));
              setAddId("");
            }}
          >
            აქტივის დამატება
          </button>
          {!preview && (
            <button
              className="button-primary"
              disabled={!validWeights || pending}
              onClick={async () => {
                setPending(true);
                try {
                  const response = await saveAllocation({
                    portfolioId,
                    rows: rows.map(({ assetId, weight }) => ({
                      assetId,
                      weight,
                    })),
                  });
                  setError(!response.ok);
                  setMessage(
                    response.ok
                      ? "მიზნობრივი განაწილება შენახულია."
                      : response.error,
                  );
                } catch {
                  setError(true);
                  setMessage("შენახვა ვერ მოხერხდა.");
                } finally {
                  setPending(false);
                }
              }}
            >
              {pending ? "ინახება…" : "განაწილების შენახვა"}
            </button>
          )}
        </div>
      </section>
      <section className="panel p-6">
        <div className="mb-6">
          <h2 className="text-sm font-medium">
            კაპიტალის განაწილების დამგეგმავი
          </h2>
          <p className="mt-2 text-xs leading-6 text-muted">
            დამატებითი თანხა ნაწილდება მიზნობრივ ღირებულებამდე არსებული
            დანაკლისების პროპორციულად. ინსტრუმენტი მხოლოდ შესყიდვებსა და თანხის
            რეზერვში დატოვებას ითვალისწინებს.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ახალი კაპიტალი (USD)">
            <input
              inputMode="decimal"
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
            />
          </Field>
          <Field label="განაწილების რეჟიმი">
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="target">მიზნობრივი</option>
              <option value="custom">ხელით განსაზღვრული</option>
            </select>
          </Field>
        </div>
        {mode === "custom" && (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => (
              <Field
                key={r.assetId}
                label={`${symbol(r.assetId)} — თანხა (USD)`}
              >
                <input
                  inputMode="decimal"
                  value={custom[r.assetId] ?? ""}
                  onChange={(e) =>
                    setCustom((c) => ({ ...c, [r.assetId]: e.target.value }))
                  }
                  placeholder="0"
                />
              </Field>
            ))}
          </div>
        )}
      </section>
      {result ? (
        <>
          <div className="panel grid grid-cols-2 gap-6 p-6">
            <Metric
              label="მიმდინარე ღირებულება"
              value={money(result.currentValue)}
            />
            <Metric
              label="ახალი კაპიტალით"
              value={money(result.projectedValue)}
            />
          </div>
          <section className="panel hidden overflow-x-auto md:block">
            <table className="w-full">
              <thead>
                <tr>
                  {[
                    "აქტივი",
                    "მიმდინარე წილი",
                    "გადახრა მიზნიდან",
                    "დამატებითი თანხა",
                    "დამატებული რაოდენობა",
                    "მოსალოდნელი წილი",
                  ].map((t) => (
                    <th className="table-head" key={t}>
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.assetId}>
                    <td className="table-cell text-xs font-medium">
                      {symbol(r.assetId)}
                    </td>
                    <td className="table-cell text-xs">
                      {percentage(r.currentWeight)}
                    </td>
                    <td className="table-cell text-xs">
                      <span className="text-muted">
                        {percentage(r.deviation, true)}
                      </span>
                      <p className="mt-1 text-[10px] text-muted">
                        {r.deviation === null
                          ? "—"
                          : decimal(r.deviation).gt(0)
                            ? "მიზანზე მეტი"
                            : decimal(r.deviation).lt(0)
                              ? "მიზანზე ნაკლები"
                              : "მიზნის შესაბამისი"}
                      </p>
                    </td>
                    <td className="table-cell numeric text-xs text-brand">
                      {money(r.capital)}
                    </td>
                    <td className="table-cell text-xs">
                      {r.addedQuantity === null
                        ? "—"
                        : quantity(r.addedQuantity)}
                    </td>
                    <td className="table-cell text-xs">
                      {percentage(r.projectedWeight)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="panel divide-y divide-line md:hidden">
            {result.rows.map((r) => (
              <div key={r.assetId} className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">
                    {symbol(r.assetId)}
                  </span>
                  <span className="numeric text-brand">{money(r.capital)}</span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <dt className="text-muted">მიმდინარე წილი</dt>
                    <dd className="mt-1">{percentage(r.currentWeight)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">მოსალოდნელი წილი</dt>
                    <dd className="mt-1">{percentage(r.projectedWeight)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">გადახრა მიზნიდან</dt>
                    <dd className="mt-1">{percentage(r.deviation, true)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">დამატებული რაოდენობა</dt>
                    <dd className="mt-1 break-all">
                      {r.addedQuantity === null
                        ? "—"
                        : quantity(r.addedQuantity)}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </section>
        </>
      ) : (
        <Message>
          {!summary.complete
            ? "შეფასებისთვის საჭიროა ყველა არსებული პოზიციის ფასი."
            : !validWeights
              ? "მიზნობრივი წილების ჯამი უნდა იყოს 100%."
              : "შეამოწმეთ კაპიტალი და თანხები. ხელით განაწილებული თანხის ჯამი ახალ კაპიტალს უნდა უდრიდეს; დასაშვებია ორი ათწილადი ნიშანი."}
        </Message>
      )}
      {message && <Message error={error}>{message}</Message>}
      <p className="text-xs leading-7 text-muted">
        შედეგი მათემატიკური განაწილებაა, საკომისიოების გარეშე. მხოლოდ დამატებითი
        თანხით მიზნის ზუსტად მიღწევა ყოველთვის შესაძლებელი არ არის. შესყიდვა ან
        გაყიდვა ავტომატურად არ სრულდება.
      </p>
    </div>
  );
}
