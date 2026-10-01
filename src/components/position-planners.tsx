"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Asset, ValuedPosition } from "@/domain/types";
import { calculateDca, calculateExit, type ExitLevel } from "@/domain/planning";
import { inputNumber, money, percentage, quantity } from "@/lib/formatters";
import { saveExitPlan } from "@/server/strategy-actions";
import { Field, Message } from "./ui";
import { Metric } from "./overview";
import { TransactionForm } from "./transaction-form";

export function DcaPlanner({
  position,
  portfolioValue,
  execution,
}: {
  position: ValuedPosition;
  portfolioValue: string | null;
  execution?: { portfolioId: string; revision: number; assets: Asset[] };
}) {
  const [capital, setCapital] = useState("1000"),
    [price, setPrice] = useState(position.quote?.price ?? ""),
    [fee, setFee] = useState("0");
  let result: ReturnType<typeof calculateDca> | null = null;
  try {
    if (position.costBasis !== null)
      result = calculateDca({
        quantity: position.quantity,
        costBasis: position.costBasis,
        capital,
        price,
        fee,
        currentPrice: position.quote?.price ?? null,
        portfolioValue,
      });
  } catch {
    /* Incomplete drafts have no result. */
  }
  return (
    <div className="dca-workspace">
      <section className="dca-controls">
        <h2 className="text-sm font-medium">დამატებითი შესყიდვა</h2>
        <Field label="დამატებითი კაპიტალი, საკომისიოს ჩათვლით (USD)">
          <input className="input input-bordered"
            inputMode="decimal"
            value={capital}
            onChange={(e) => setCapital(e.target.value)}
          />
        </Field>
        <Field label="მოსალოდნელი შესყიდვის ფასი (USD)">
          <input className="input input-bordered"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </Field>
        <Field label="საკომისიო (USD)">
          <input className="input input-bordered"
            inputMode="decimal"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
          />
        </Field>
        <p className="text-xs leading-6 text-muted">
          სიმულაცია ვარაუდობს ახალი კაპიტალის დამატებას. წილი ფასდება აქტივის
          მიმდინარე ფასით. ტრანზაქცია ავტომატურად არ იქმნება.
        </p>
      </section>
      <section className="dca-result">
        <h2 className="mb-7 text-sm font-medium">
          შესყიდვის მოსალოდნელი შედეგი
        </h2>
        {result ? (
          <>
            <div className="dca-result-grid">
              <Metric
                label="მიმდინარე საშუალო ფასი"
                value={money(result.currentAverage)}
              />
              <Metric
                label="ახალი საშუალო ფასი"
                value={money(result.newAverage)}
                tone="text-brand"
              />
              <Metric
                label="მიმდინარე რაოდენობა"
                value={quantity(position.quantity)}
              />
              <Metric
                label="დამატებული რაოდენობა"
                value={quantity(result.addedQuantity)}
              />
              <Metric
                label="ახალი რაოდენობა"
                value={quantity(result.newQuantity)}
              />
              <Metric
                label="ახალი თვითღირებულება"
                value={money(result.newBasis)}
              />
              <Metric
                label="მიმდინარე წილი"
                value={percentage(position.allocation)}
              />
              <Metric
                label="მოსალოდნელი წილი"
                value={percentage(result.projectedAllocation)}
              />
            </div>
            <p className="mt-7 border-t border-line pt-5 text-xs leading-6 text-muted">
              თუ შესყიდვა რეალურად განახორციელეთ, დაამატეთ ტრანზაქცია ფაქტობრივი
              რაოდენობით, ფასითა და საკომისიოთი.
            </p>
            {execution && (
              <div className="mt-5 space-y-3">
                <TransactionForm
                  {...execution}
                  initialAsset={position.assetId}
                  draft={{ quantity: result.addedQuantity, price, fee }}
                  triggerLabel="შესყიდვის ჩანაწერის მომზადება"
                />
                <p className="text-xs leading-6 text-muted">
                  შეამოწმეთ ფაქტობრივი შესრულება და თარიღი, შემდეგ დაადასტურეთ
                  შენახვა. ახალი დაფინანსება წინასწარ უნდა აღრიცხოთ USD-ის
                  შეტანით.
                </p>
              </div>
            )}
          </>
        ) : (
          <Message>
            {position.costBasis === null
              ? "გამოთვლისთვის საჭიროა ცნობილი თვითღირებულება."
              : "შეიყვანეთ დადებითი კაპიტალი და ფასი. საკომისიო კაპიტალზე ნაკლები უნდა იყოს."}
          </Message>
        )}
      </section>
    </div>
  );
}
export function ExitPlanner({
  position,
  portfolioId,
  initial,
  preview = false,
}: {
  position: ValuedPosition;
  portfolioId: string;
  initial?: { feePercent: string; levels: ExitLevel[] } | null;
  preview?: boolean;
}) {
  const [levels, setLevels] = useState<ExitLevel[]>(
      initial?.levels.map((level) => ({ price: inputNumber(level.price), percentage: inputNumber(level.percentage) })) ?? [{ price: "", percentage: "25" }],
    ),
    [feePercent, setFee] = useState(inputNumber(initial?.feePercent ?? "0")),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false),
    [pending, setPending] = useState(false);
  let result: ReturnType<typeof calculateExit> | null = null;
  try {
    if (position.costBasis !== null)
      result = calculateExit({
        quantity: position.quantity,
        costBasis: position.costBasis,
        feePercent,
        levels,
      });
  } catch {
    /* Validate drafts without inventing outputs. */
  }
  function update(i: number, field: keyof ExitLevel, value: string) {
    setLevels((l) =>
      l.map((item, n) => (n === i ? { ...item, [field]: value } : item)),
    );
    setMessage("");
  }
  return (
    <div className="exit-planner">
      <section className="card panel exit-editor">
        <div className="exit-editor-heading">
          <div>
            <h2 className="text-sm font-medium">გაყიდვის ეტაპები</h2>
            <p className="mt-2 text-xs leading-6 text-muted">
              ყველა წილი ითვლება მიმდინარე {quantity(position.quantity)}{" "}
              {position.asset.symbol}-იდან. ფასები ეტაპობრივად უნდა იზრდებოდეს.
            </p>
          </div>
          <div className="exit-fee-field">
            <Field label="საკომისიო (%)">
              <input className="input input-bordered"
                value={feePercent}
                inputMode="decimal"
                onChange={(e) => {
                  setFee(e.target.value);
                  setMessage("");
                }}
              />
            </Field>
          </div>
        </div>
        <div className="exit-levels" role="table" aria-label="გაყიდვის ეტაპები">
          <div className="exit-level-head" role="row"><span>ეტაპი</span><span>სამიზნე ფასი</span><span>გასაყიდი %</span><span>რაოდენობა</span><span>შემოსავალი</span><span /></div>
          {levels.map((level, i) => (
            <div
              key={i}
              className="exit-level-row"
            >
              <span className="exit-level-name">TP{i + 1}</span>
              <Field label="სამიზნე ფასი (USD)">
                <input className="input input-bordered"
                  value={level.price}
                  inputMode="decimal"
                  onChange={(e) => update(i, "price", e.target.value)}
                  placeholder="0.00"
                />
              </Field>
              <Field label="გასაყიდი წილი (%)">
                <input className="input input-bordered"
                  value={level.percentage}
                  inputMode="decimal"
                  onChange={(e) => update(i, "percentage", e.target.value)}
                />
              </Field>
              <span className="exit-level-quantity">{result?.levels[i] ? quantity(result.levels[i].quantity) : "—"}</span>
              <span className="exit-level-revenue">{result?.levels[i] ? money(result.levels[i].revenue) : "—"}</span>
              <button
                className="mb-2 rounded p-2 text-muted hover:text-negative"
                aria-label={`TP${i + 1}-ის წაშლა`}
                disabled={levels.length <= 1}
                onClick={() => {
                  setLevels((l) => l.filter((_, n) => n !== i));
                  setMessage("");
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
        <div className="exit-editor-actions"><button
          className="btn btn-ghost button-secondary"
          disabled={levels.length >= 12}
          onClick={() =>
            setLevels((l) => [...l, { price: "", percentage: "10" }])
          }
        >
          <Plus size={15} />
          ეტაპის დამატება
        </button>{!preview && <button className="btn btn-primary button-primary" disabled={!result || pending} onClick={async () => {
          setPending(true);
          try { const response = await saveExitPlan({ portfolioId, assetId: position.assetId, feePercent, levels }); setError(!response.ok); setMessage(response.ok ? "გასვლის გეგმა შენახულია." : response.error); }
          catch { setError(true); setMessage("შენახვა ვერ მოხერხდა."); }
          finally { setPending(false); }
        }}>{pending ? "ინახება…" : "გეგმის შენახვა"}</button>}</div>
      </section>
      {result ? (
        <aside className="exit-results">
          <div className="card panel exit-summary">
            <Metric
              label="მოსალოდნელი წმინდა შემოსავალი"
              value={money(result.revenue)}
            />
            <Metric label="მოსალოდნელი მოგება" value={money(result.profit)} />
            <Metric
              label="დარჩენილი პოზიცია"
              value={`${quantity(result.remainingQuantity)} ${position.asset.symbol}`}
            />
            <Metric
              label="საშუალო წმინდა გასვლის ფასი"
              value={money(result.weightedExitPrice)}
            />
          </div>
          <section className="card panel exit-recovery">
            <h2 className="text-sm font-medium">კაპიტალის ამოღება</h2>
            <p className="mt-3 text-xs leading-7 text-muted">
              აღსადგენი თვითღირებულება: {money(position.costBasis)}.{" "}
              {result.alreadyRecovered
                ? "დარჩენილ პოზიციას ნულოვანი თვითღირებულება აქვს."
                : result.recoveryLevel
                  ? `კაპიტალი სრულად ამოიღება TP${result.recoveryLevel} ეტაპზე, ამ ეტაპის ${quantity(result.recoveryQuantity!)} ${position.asset.symbol}-ის გაყიდვის შემდეგ.`
                  : "მოცემული ეტაპებით საწყისი თვითღირებულება სრულად ვერ ამოიღება."}{" "}
              დარჩება პოზიციის {percentage(result.remainingPercent)}.
            </p>
            <div className="mt-5 divide-y divide-line">
              {result.levels.map((l, i) => (
                <div
                  key={i}
                  className="flex flex-wrap justify-between gap-3 py-3 text-xs"
                >
                  <span className="text-brand">
                    TP{i + 1} · {quantity(l.quantity)} {position.asset.symbol}
                  </span>
                  <span>შემოსავალი: {money(l.revenue)}</span>
                  <span className="text-muted">მოგება: {money(l.profit)}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      ) : (
        <Message>
          შეიყვანეთ ზრდადი დადებითი ფასები. წილების ჯამი არ უნდა აღემატებოდეს
          100%-ს; თვითღირებულება ცნობილი უნდა იყოს.
        </Message>
      )}
      {message && <Message error={error}>{message}</Message>}
    </div>
  );
}
