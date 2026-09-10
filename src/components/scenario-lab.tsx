"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Plus, Save, Trash2 } from "lucide-react";
import type { PortfolioSummary } from "@/domain/types";
import { calculateScenario, goalProgress } from "@/domain/scenarios";
import { money, percentage, quantity, pnlClass } from "@/lib/formatters";
import {
  saveScenario,
  deleteScenario,
  saveGoal,
} from "@/server/scenario-actions";
import { AssetIcon } from "./positions";
import { Field, Message, Modal } from "./ui";
import { Metric } from "./overview";

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
    [deleting, setDeleting] = useState(false);
  const router = useRouter();
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
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <select
          aria-label="შენახული სცენარი"
          value={active}
          onChange={(e) => choose(e.target.value)}
          className="max-w-sm"
        >
          <option value="">სწრაფი სცენარი</option>
          {saved.map((s) => (
            <option value={s.id} key={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button className="button-secondary" onClick={() => choose("")}>
          <Plus size={15} />
          ახალი სცენარი
        </button>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <section className="panel p-6">
          <div className="mb-6">
            <h2 className="text-sm font-medium">რა მოხდება, თუ…</h2>
            <p className="mt-2 text-xs leading-6 text-muted">
              შეცვალეთ ფასები. რაოდენობები ავტომატურად აიღება მიმდინარე
              პორტფელიდან.
            </p>
          </div>
          <div className="divide-y divide-line">
            {summary.positions.map((p, i) => (
              <div
                key={p.assetId}
                className="grid grid-cols-[1fr_130px] items-center gap-4 py-4 sm:grid-cols-[1fr_180px]"
              >
                <div className="flex items-center gap-3">
                  <AssetIcon symbol={p.asset.symbol} index={i} />
                  <div>
                    <p className="text-xs font-medium">{p.asset.symbol}</p>
                    <p className="mt-1 text-[10px] text-muted">
                      {quantity(p.quantity)} · ახლა{" "}
                      {money(p.quote?.price ?? null)}
                    </p>
                  </div>
                </div>
                <Field label={`${p.asset.symbol} — სამიზნე ფასი (USD)`}>
                  <input
                    inputMode="decimal"
                    value={prices[p.assetId] ?? ""}
                    placeholder={p.quote?.price ?? "შეიყვანეთ ფასი"}
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
            ))}
            {!summary.positions.length && (
              <p className="py-10 text-center text-xs text-muted">
                სცენარისთვის ჯერ დაამატეთ პოზიცია.
              </p>
            )}
          </div>
          <p className="mt-5 text-[11px] leading-6 text-muted">
            ცარიელ ველში გამოიყენება მიმდინარე ხელმისაწვდომი ფასი. USD-ის ნაშთი
            უცვლელია. ნულოვანი ფასი აქტივის ღირებულების სრულ დაკარგვას ნიშნავს.
          </p>
        </section>
        <div className="space-y-6">
          <section className="panel p-6">
            <p className="text-xs text-muted">სცენარის პორტფელის ღირებულება</p>
            <p className="numeric mt-5 text-4xl text-brand">
              {money(result?.value ?? null)}
            </p>
            <div className="mt-7 grid grid-cols-2 gap-6">
              <Metric
                label="მიმდინარე ღირებულება"
                value={money(summary.value)}
              />
              <Metric
                label="ცვლილება მიმდინარე ღირებულებიდან"
                value={money(result?.growth ?? null)}
                tone={pnlClass(result?.growth ?? null)}
              />
              <Metric
                label="პოტენციური ზრდა"
                value={percentage(result?.returnPercent ?? null, true)}
              />
              <Metric
                label="სცენარის არარეალიზებული მოგება / ზარალი"
                value={money(result?.unrealizedPnl ?? null)}
              />
            </div>
          </section>
          <section className="panel p-6">
            <h2 className="mb-4 text-sm font-medium">სცენარის განაწილება</h2>
            {result?.positions.map((p) => (
              <div
                key={p.assetId}
                className="flex justify-between gap-3 border-b border-line py-3 text-xs"
              >
                <span>
                  {p.symbol}
                  {p.assumedCurrentPrice && (
                    <span className="ml-2 text-[10px] text-muted">
                      მიმდინარე ფასი
                    </span>
                  )}
                </span>
                <span className="text-muted">
                  {money(p.value)} · {percentage(p.allocation)}
                </span>
              </div>
            ))}
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
        <div className="panel flex flex-wrap items-end gap-3 p-5">
          <div className="min-w-52 flex-1">
            <Field label="სცენარის სახელი">
              <input
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                placeholder="მაგ. ზრდის სცენარი 2027"
              />
            </Field>
          </div>
          <button
            className="button-primary"
            disabled={pending || !result || !summary.positions.length}
            onClick={() => void save()}
          >
            <Save size={15} />
            {pending ? "ინახება…" : "შენახვა"}
          </button>
          {active && (
            <>
              <button
                className="button-secondary"
                disabled={pending}
                onClick={() => void save(true)}
              >
                <Copy size={15} />
                ასლის შექმნა
              </button>
              <button
                className="button-danger"
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
        current={summary.value}
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
          className="button-danger"
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
  let progress: ReturnType<typeof goalProgress> | null = null,
    scenario: ReturnType<typeof goalProgress> | null = null;
  try {
    progress = goalProgress(current, target);
    scenario = goalProgress(scenarioValue, target);
  } catch {
    /* A goal is optional until entered. */
  }
  return (
    <section className="panel p-6">
      <div className="mb-6">
        <h2 className="text-sm font-medium">პორტფელის მიზანი</h2>
        <p className="mt-2 text-xs text-muted">
          შეადარეთ მიმდინარე პორტფელი და სცენარი თქვენს მიზანს.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Field label="მიზნობრივი ღირებულება (USD)">
            <input
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
              className="button-secondary"
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
                <Metric label="დარჩენილი თანხა" value={money(progress.gap)} />
                <Metric
                  label="საჭირო ზრდა"
                  value={percentage(progress.requiredGrowth)}
                />
                <Metric
                  label="სცენარსა და მიზანს შორის სხვაობა"
                  value={money(scenario?.gap ?? null)}
                />
              </div>
              <div className="mt-6 h-2 overflow-hidden rounded-full bg-raised">
                <div
                  className="h-full rounded-full bg-brand"
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
                      className={`rounded-md border px-2 py-1 text-xs ${current !== null && Number(current) >= Number(m) ? "border-brand/30 text-brand" : "border-line text-muted"}`}
                    >
                      {money(m)}{" "}
                      {current !== null && Number(current) >= Number(m)
                        ? "✓"
                        : ""}
                    </span>
                  ))}
              </div>
            </>
          ) : (
            <p className="pt-8 text-xs text-muted">
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
    </section>
  );
}
