"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Copy, Percent, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import type { PortfolioSummary } from "@/domain/types";
import { calculateScenario, goalProgress } from "@/domain/scenarios";
import {
  money,
  percentage,
  quantity,
  pnlClass,
  unitPrice,
} from "@/lib/formatters";
import {
  saveScenario,
  deleteScenario,
  saveGoal,
} from "@/server/scenario-actions";
import { AssetIcon } from "./positions";
import { BalanceValue, Field, Message, Modal } from "./ui";
import { useBalancesHidden } from "./balance-privacy";
import { Metric } from "./overview";
import {
  investablePositions,
  investableValue,
} from "@/domain/portfolio-segments";

export interface SavedScenario {
  id: string;
  name: string;
  prices: Record<string, string>;
}
export interface Goal {
  target: string;
  milestones: string[];
}
export function ScenarioLab({
  summary,
  portfolioId,
  saved,
  goal,
  preview = false,
}: {
  summary: PortfolioSummary;
  portfolioId: string;
  saved: SavedScenario[];
  goal: Goal | null;
  preview?: boolean;
}) {
  const [active, setActive] = useState(""),
    [name, setName] = useState(""),
    [prices, setPrices] = useState<Record<string, string>>({}),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false),
    [deleting, setDeleting] = useState(false),
    [bulkChange, setBulkChange] = useState("");
  const router = useRouter();
  const balancesHidden = useBalancesHidden();
  const cryptoPositions = investablePositions(summary);
  const cryptoValue = investableValue(summary);
  let result: ReturnType<typeof calculateScenario> | null = null;
  try {
    result = calculateScenario(summary, prices);
  } catch {
    /* Incomplete price drafts remain unvalued. */
  }
  function choose(id: string) {
    const scenario = saved.find((s) => s.id === id);
    setActive(id);
    setName(scenario?.name ?? "");
    setPrices(scenario?.prices ?? {});
    setMessage("");
  }
  function applyPercentageChange() {
    const change = Number(bulkChange);
    if (!Number.isFinite(change)) return;
    setPrices(
      Object.fromEntries(
        cryptoPositions.flatMap((position) => {
          const price = Number(position.quote?.price ?? 0);
          return Number.isFinite(price) && price >= 0
            ? [[position.assetId, String(price * (1 + change / 100))]]
            : [];
        }),
      ),
    );
    setMessage("");
  }
  const priceRow = (p: (typeof cryptoPositions)[number], i: number) => (
    <div
      key={p.assetId}
      className="grid grid-cols-[minmax(0,1fr)_130px] items-center gap-3 py-2 sm:grid-cols-[minmax(0,1fr)_180px]"
    >
      <div className="flex items-center gap-3">
        <AssetIcon
          symbol={p.asset.symbol}
          logoUrl={p.asset.logoUrl}
          index={i}
        />
        <div>
          <p className="text-xs font-medium">{p.asset.symbol}</p>
          <p className="mt-1 text-[10px] text-base-content/60">
            <BalanceValue>{quantity(p.quantity)}</BalanceValue> · ახლა{" "}
            {unitPrice(p.quote?.price ?? null)}
          </p>
        </div>
      </div>
      <Field label={`${p.asset.symbol} — სამიზნე ფასი (USD)`}>
        <input
          className="input"
          type={balancesHidden ? "password" : "text"}
          inputMode="decimal"
          value={prices[p.assetId] ?? ""}
          placeholder={
            unitPrice(p.quote?.price ?? null) === "—"
              ? "შეიყვანეთ ფასი"
              : unitPrice(p.quote?.price ?? null)
          }
          onChange={(e) => {
            setPrices((current) => ({
              ...current,
              [p.assetId]: e.target.value,
            }));
            setMessage("");
          }}
        />
      </Field>
    </div>
  );
  async function save(copy = false) {
    if (preview) return;
    setPending(true);
    setMessage("");
    try {
      const id = active && !copy ? active : crypto.randomUUID();
      const title = copy ? `${name || "სცენარი"} — ასლი` : name;
      const response = await saveScenario(
        {
          id,
          portfolioId,
          name: title,
          prices: Object.entries(prices)
            .filter(([, price]) => price.trim() !== "")
            .map(([assetId, price]) => ({ assetId, price })),
        },
        active && !copy ? "update" : "create",
      );
      setError(!response.ok);
      setMessage(response.ok ? "სცენარი შენახულია." : response.error);
      if (response.ok) {
        setActive(id);
        setName(title);
        router.refresh();
      }
    } catch {
      setError(true);
      setMessage("შენახვა ვერ მოხერხდა.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="space-y-3 lg:space-y-4">
      <div className="card flex-row flex-wrap gap-3 bg-base-200 p-4">
        <select
          aria-label="შენახული სცენარი"
          value={active}
          onChange={(e) => choose(e.target.value)}
          className="select w-full max-w-sm"
        >
          <option value="">სწრაფი სცენარი</option>
          {saved.map((s) => (
            <option value={s.id} key={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button className="btn btn-outline" onClick={() => choose("")}>
          <Plus size={15} />
          ახალი სცენარი
        </button>
      </div>
      <div className="grid items-start gap-3 lg:gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(260px,3fr)]">
        <section className="card bg-base-200">
          <div className="card-body min-w-0 gap-3 p-4">
            <div>
              <div>
                <h2 className="text-base font-medium">რა მოხდება, თუ…</h2>
                <p className="mt-2 text-xs leading-6 text-base-content/60">
                  შეცვალეთ ფასები. რაოდენობები ავტომატურად აიღება მიმდინარე
                  პორტფელიდან.
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <label className="input">
                  <Percent size={13} />
                  <input
                    aria-label="საერთო პროცენტული ცვლილება"
                    inputMode="decimal"
                    value={bulkChange}
                    onChange={(event) => setBulkChange(event.target.value)}
                    placeholder="მაგ. -20"
                  />
                  <span>%</span>
                </label>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={applyPercentageChange}
                  disabled={!bulkChange.trim()}
                >
                  გამოყენება
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setPrices({});
                    setBulkChange("");
                    setMessage("");
                  }}
                >
                  <RotateCcw size={14} /> მიმდინარე ფასები
                </button>
              </div>
            </div>
            <div className="divide-y divide-base-300">
              {cryptoPositions.slice(0, 6).map(priceRow)}
              {cryptoPositions.length > 6 && (
                <details className="collapse collapse-arrow">
                  <summary className="collapse-title">
                    დარჩენილი {cryptoPositions.length - 6} აქტივის რედაქტირება
                  </summary>
                  <div className="collapse-content">
                    {cryptoPositions.slice(6).map((p, i) => priceRow(p, i + 6))}
                  </div>
                </details>
              )}
              {!cryptoPositions.length && (
                <p className="py-10 text-center text-xs text-base-content/60">
                  სცენარისთვის ჯერ დაამატეთ პოზიცია.
                </p>
              )}
            </div>
            <p className="mt-5 text-[11px] leading-6 text-base-content/60">
              ცარიელ ველში გამოიყენება მიმდინარე ხელმისაწვდომი ფასი. Cash და
              სტეიბლკოინები ამ სცენარისგან გამოთიშულია. ნულოვანი ფასი აქტივის
              ღირებულების სრულ დაკარგვას ნიშნავს.
            </p>
          </div>
        </section>
        <div className="space-y-3 lg:space-y-4">
          <section className="card bg-base-200">
            <div className="card-body min-w-0 gap-3 p-4">
              <p className="text-xs text-base-content/60">
                სცენარის კრიპტო ღირებულება
              </p>
              <p className="numeric mt-2 whitespace-nowrap text-2xl text-base-content">
                <BalanceValue>{money(result?.value ?? null)}</BalanceValue>
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Metric
                  label="მიმდინარე ღირებულება"
                  value={money(cryptoValue)}
                  sensitive
                />
                <Metric
                  label="ცვლილება მიმდინარე ღირებულებიდან"
                  value={money(result?.growth ?? null)}
                  tone={pnlClass(result?.growth ?? null)}
                  sensitive
                />
                <Metric
                  label="პოტენციური ზრდა"
                  value={percentage(result?.returnPercent ?? null, true)}
                />
                <Metric
                  label="სცენარის არარეალიზებული მოგება / ზარალი"
                  value={money(result?.unrealizedPnl ?? null)}
                  sensitive
                />
              </div>
            </div>
          </section>
          <section className="card bg-base-200">
            <div className="card-body min-w-0 gap-3 p-4">
              <h2 className="mb-4 text-base font-medium">
                სცენარის განაწილება
              </h2>
              {result?.positions.slice(0, 6).map((p) => (
                <div
                  key={p.assetId}
                  className="flex justify-between gap-3 border-b border-base-300 py-3 text-xs"
                >
                  <Link
                    href={`/portfolios/${portfolioId}/strategy?asset=${encodeURIComponent(p.assetId)}`}
                    className="scenario-result-asset"
                  >
                    {p.symbol}
                    {p.assumedCurrentPrice && (
                      <span className="ml-2 text-[10px] text-base-content/60">
                        მიმდინარე ფასი
                      </span>
                    )}
                  </Link>
                  <span className="text-base-content/60">
                    <BalanceValue>{money(p.value)}</BalanceValue> ·{" "}
                    {percentage(p.allocation)}
                  </span>
                </div>
              ))}
              {(result?.positions.length ?? 0) > 6 && (
                <details className="collapse collapse-arrow">
                  <summary className="collapse-title min-h-11 text-xs">
                    დარჩენილი {(result?.positions.length ?? 0) - 6} აქტივი
                  </summary>
                  <div className="collapse-content space-y-2">
                    {result?.positions.slice(6).map((p) => (
                      <div
                        key={p.assetId}
                        className="flex justify-between gap-3 border-b border-base-300 py-2 text-xs"
                      >
                        <span>{p.symbol}</span>
                        <span className="text-base-content/60">
                          <BalanceValue>{money(p.value)}</BalanceValue> ·{" "}
                          {percentage(p.allocation)}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </section>
        </div>
      </div>
      {!result && (
        <Message error>
          სამიზნე ფასები უნდა იყოს ნული ან დადებითი რიცხვი.
        </Message>
      )}
      {message && <Message error={error}>{message}</Message>}
      {!preview && (
        <div className="card flex-row flex-wrap items-end gap-3 bg-base-200 p-4">
          <div className="min-w-52 flex-1">
            <Field label="სცენარის სახელი">
              <input
                className="input"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                placeholder="მაგ. ზრდის სცენარი 2027"
              />
            </Field>
          </div>
          <button
            className="btn btn-primary"
            disabled={pending || !result || !cryptoPositions.length}
            onClick={() => void save()}
          >
            <Save size={15} />
            {pending ? "ინახება…" : "შენახვა"}
          </button>
          {active && (
            <>
              <button
                className="btn btn-outline"
                disabled={pending}
                onClick={() => void save(true)}
              >
                <Copy size={15} />
                ასლის შექმნა
              </button>
              <button
                className="btn btn-error"
                disabled={pending}
                onClick={() => setDeleting(true)}
              >
                <Trash2 size={15} />
                წაშლა
              </button>
            </>
          )}
        </div>
      )}
      <GoalPlanner
        portfolioId={portfolioId}
        current={cryptoValue}
        scenarioValue={result?.value ?? null}
        initial={goal}
        preview={preview}
      />
      <Modal
        open={deleting}
        onOpenChange={setDeleting}
        title="სცენარის წაშლა"
        description="სცენარი წაიშლება. პორტფელის რეალური ტრანზაქციები ამ მოქმედებით არ იცვლება."
      >
        <button
          className="btn btn-error"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            try {
              const response = await deleteScenario(portfolioId, active);
              if (response.ok) {
                choose("");
                setDeleting(false);
                router.refresh();
              } else {
                setError(true);
                setMessage(response.error);
              }
            } catch {
              setError(true);
              setMessage("წაშლა ვერ მოხერხდა.");
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
function GoalPlanner({
  portfolioId,
  current,
  scenarioValue,
  initial,
  preview,
}: {
  portfolioId: string;
  current: string | null;
  scenarioValue: string | null;
  initial: Goal | null;
  preview: boolean;
}) {
  const [target, setTarget] = useState(initial?.target ?? ""),
    [milestones, setMilestones] = useState(
      initial?.milestones.join("; ") ?? "",
    ),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false),
    [pending, setPending] = useState(false);
  const balancesHidden = useBalancesHidden();
  let progress: ReturnType<typeof goalProgress> | null = null,
    scenario: ReturnType<typeof goalProgress> | null = null;
  try {
    progress = goalProgress(current, target);
    scenario = goalProgress(scenarioValue, target);
  } catch {
    /* A goal is optional until entered. */
  }
  return (
    <details className="collapse collapse-arrow border border-base-300 bg-base-200 lg:collapse-open">
      <summary className="collapse-title min-h-11 text-sm font-semibold">
        პორტფელის მიზანი
      </summary>
      <div className="collapse-content">
        <div className="sr-only">
          <h2 className="text-base font-medium">პორტფელის მიზანი</h2>
          <p className="mt-2 text-xs text-base-content/60">
            შეადარეთ მიმდინარე პორტფელი და სცენარი თქვენს მიზანს.
          </p>
        </div>
        <div className="grid gap-3 lg:gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <Field label="მიზნობრივი ღირებულება (USD)">
              <input
                className="input"
                type={balancesHidden ? "password" : "text"}
                inputMode="decimal"
                value={target}
                onChange={(e) => {
                  setTarget(e.target.value);
                  setMessage("");
                }}
                placeholder="100000"
              />
            </Field>
            <Field label="შუალედური მიზნები — გამოყავით წერტილ-მძიმით">
              <input
                className="input"
                type={balancesHidden ? "password" : "text"}
                value={milestones}
                maxLength={500}
                onChange={(e) => {
                  setMilestones(e.target.value);
                  setMessage("");
                }}
                placeholder="50000; 75000"
              />
            </Field>
            {!preview && (
              <button
                className="btn btn-outline"
                disabled={!progress || pending}
                onClick={async () => {
                  setPending(true);
                  try {
                    const response = await saveGoal({
                      portfolioId,
                      target,
                      milestones: milestones
                        .split(";")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    });
                    setError(!response.ok);
                    setMessage(
                      response.ok ? "მიზანი შენახულია." : response.error,
                    );
                  } catch {
                    setError(true);
                    setMessage("შენახვა ვერ მოხერხდა.");
                  } finally {
                    setPending(false);
                  }
                }}
              >
                {pending ? "ინახება…" : "მიზნის შენახვა"}
              </button>
            )}
          </div>
          <div>
            {progress ? (
              <>
                <div className="grid grid-cols-2 gap-6">
                  <Metric
                    label="მიმდინარე პროგრესი"
                    value={percentage(progress.progress)}
                  />
                  <Metric
                    label="დარჩენილი თანხა"
                    value={money(progress.gap)}
                    sensitive
                  />
                  <Metric
                    label="საჭირო ზრდა"
                    value={percentage(progress.requiredGrowth)}
                  />
                  <Metric
                    label="სცენარსა და მიზანს შორის სხვაობა"
                    value={money(scenario?.gap ?? null)}
                    sensitive
                  />
                </div>
                <div className="mt-6 h-2 overflow-hidden rounded-full bg-base-300">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Number(progress.progress ?? 0)}%` }}
                  />
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {milestones
                    .split(";")
                    .map((s) => s.trim())
                    .filter((s) => /^\d{1,24}(\.\d{1,18})?$/.test(s))
                    .slice(0, 12)
                    .map((m, i) => (
                      <span
                        key={i}
                        className={`rounded-md border px-2 py-1 text-xs ${current !== null && Number(current) >= Number(m) ? "border-primary/30 text-primary" : "border-base-300 text-base-content/60"}`}
                      >
                        <BalanceValue>{money(m)}</BalanceValue>{" "}
                        {current !== null && Number(current) >= Number(m)
                          ? "✓"
                          : ""}
                      </span>
                    ))}
                </div>
              </>
            ) : (
              <p className="pt-8 text-xs text-base-content/60">
                მიზნის დასაყენებლად შეიყვანეთ დადებითი თანხა.
              </p>
            )}
          </div>
        </div>
        {message && (
          <div className="mt-5">
            <Message error={error}>{message}</Message>
          </div>
        )}
      </div>
    </details>
  );
}
