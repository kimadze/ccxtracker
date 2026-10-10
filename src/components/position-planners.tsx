"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Asset, ValuedPosition } from "@/domain/types";
import {
  calculateDca,
  calculateExit,
  type ExitLevel,
  type SavedExitPlan,
} from "@/domain/planning";
import { decimal } from "@/domain/decimal";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { inputNumber, money, percentage, quantity } from "@/lib/formatters";
import { saveExitPlan, rearmTakeProfit } from "@/server/strategy-actions";
import { Field, Message } from "./ui";
import { BalanceValue } from "./ui";
import { Metric } from "./overview";
import { TransactionForm } from "./transaction-form";
import { useBalancesHidden } from "./balance-privacy";

export function DcaPlanner({
  position,
  portfolioValue,
  execution,
}: {
  position: ValuedPosition;
  portfolioValue: string | null;
  execution?: { portfolioId: string; revision: number; assets: Asset[] };
}) {
  const balancesHidden = useBalancesHidden();
  const [capital, setCapital] = useState("1000"),
    [price, setPrice] = useState(
      position.quote ? inputNumber(position.quote.price) : "",
    ),
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
    <div className="grid gap-3">
      <section className="space-y-3">
        <h2 className="text-base font-medium">დამატებითი შესყიდვა</h2>
        <div className="grid grid-cols-2 items-end gap-x-3 gap-y-1">
          <div className="col-span-2">
            <Field label="კაპიტალი + საკომისიო (USD)">
              <input
                className="input"
                type={balancesHidden ? "password" : "text"}
                inputMode="decimal"
                value={capital}
                onChange={(e) => setCapital(e.target.value)}
              />
            </Field>
          </div>
          <Field label="შესყიდვის ფასი (USD)">
            <input
              className="input"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </Field>
          <Field label="საკომისიო (USD)">
            <input
              className="input"
              type={balancesHidden ? "password" : "text"}
              inputMode="decimal"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
            />
          </Field>
        </div>
        <p className="text-xs leading-5 text-base-content/60">
          სიმულაცია ვარაუდობს ახალი კაპიტალის დამატებას. წილი ფასდება აქტივის
          მიმდინარე ფასით. ტრანზაქცია ავტომატურად არ იქმნება.
        </p>
      </section>
      <section className="border-t border-base-300 pt-3">
        <h2 className="mb-3 text-base font-medium">
          შესყიდვის მოსალოდნელი შედეგი
        </h2>
        {result ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Metric
                compact
                label="მიმდინარე საშუალო ფასი"
                value={money(result.currentAverage)}
                sensitive
              />
              <Metric
                compact
                label="ახალი საშუალო ფასი"
                value={money(result.newAverage)}
                tone="text-primary"
                sensitive
              />
              <Metric
                compact
                label="მიმდინარე რაოდენობა"
                value={quantity(position.quantity)}
                sensitive
              />
              <Metric
                compact
                label="დამატებული რაოდენობა"
                value={quantity(result.addedQuantity)}
                sensitive
              />
              <Metric
                compact
                label="ახალი რაოდენობა"
                value={quantity(result.newQuantity)}
                sensitive
              />
              <Metric
                compact
                label="ახალი თვითღირებულება"
                value={money(result.newBasis)}
                sensitive
              />
              <Metric
                compact
                label="მიმდინარე წილი"
                value={percentage(position.allocation)}
              />
              <Metric
                compact
                label="მოსალოდნელი წილი"
                value={percentage(result.projectedAllocation)}
              />
            </div>
            <p className="mt-3 border-t border-base-300 pt-3 text-xs leading-6 text-base-content/60">
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
                <p className="text-xs leading-6 text-base-content/60">
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
  initial?: SavedExitPlan | null;
  preview?: boolean;
}) {
  const balancesHidden = useBalancesHidden();
  const router = useRouter();
  const [telegramEnabled, setTelegramEnabled] = useState(
    initial?.telegramEnabled ?? false,
  );
  const [rearmed, setRearmed] = useState<string[]>([]);
  const [levels, setLevels] = useState<ExitLevel[]>(
      initial?.levels.map((level) => ({
        price: inputNumber(level.price),
        percentage: inputNumber(level.percentage),
      })) ?? [{ price: "", percentage: "25" }],
    ),
    [feePercent, setFee] = useState(inputNumber(initial?.feePercent ?? "0")),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false),
    [pending, setPending] = useState(false);
  let result: ReturnType<typeof calculateExit> | null = null;
  try {
    result = calculateExit({
      quantity: position.quantity,
      costBasis: position.costBasis ?? "0",
      feePercent,
      levels,
    });
  } catch {
    /* Validate drafts without inventing outputs. */
  }
  const levelsChanged =
    !initial ||
    initial.levels.length !== levels.length ||
    levels.some((level, i) => {
      try {
        return (
          !decimal(level.price).eq(initial.levels[i].price) ||
          !decimal(level.percentage).eq(initial.levels[i].percentage)
        );
      } catch {
        return true;
      }
    });
  function update(i: number, field: keyof ExitLevel, value: string) {
    setLevels((l) =>
      l.map((item, n) => (n === i ? { ...item, [field]: value } : item)),
    );
    setMessage("");
  }
  return (
    <div className="space-y-3 lg:space-y-4">
      <section className="min-w-0">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="grid grid-cols-[minmax(0,1fr)_110px] items-start gap-3">
            <div>
              <h2 className="text-base font-medium">Take Profit</h2>
              <p className="mt-1 text-xs leading-5 text-base-content/60">
                ყველა წილი ითვლება მიმდინარე{" "}
                <BalanceValue>{quantity(position.quantity)}</BalanceValue>{" "}
                {position.asset.symbol}-იდან. ფასები ეტაპობრივად უნდა
                იზრდებოდეს.
              </p>
            </div>
            <div className="min-w-0">
              <Field label="საკომისიო (%)">
                <input
                  className="input"
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
          {!preview && (
            <div className="flex flex-wrap items-center gap-3">
              <label className="label min-h-11 gap-3">
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={telegramEnabled}
                  onChange={(e) => setTelegramEnabled(e.target.checked)}
                />
                Telegram ალერტები
              </label>
              <Link
                className="link text-xs"
                href={`/portfolios/${portfolioId}/settings#settings-telegram`}
              >
                Telegram-ის დაკავშირება
              </Link>
            </div>
          )}
          {telegramEnabled && (
            <p className="text-xs text-base-content/60">
              თითო დონე ერთხელ შეგატყობინებს. გაყიდვა ავტომატურად არ შესრულდება.
            </p>
          )}
          {initial?.telegramEnabled &&
            initial.alertQuantity &&
            !decimal(initial.alertQuantity).eq(position.quantity) && (
              <Message error>
                რაოდენობა შეიცვალა. ალერტები შეჩერებულია — გადაამოწმე და შეინახე
                გეგმა.
              </Message>
            )}
          <div
            className="divide-y divide-base-300"
            role="table"
            aria-label="გაყიდვის ეტაპები"
          >
            {levels.map((level, i) => (
              <div
                key={i}
                className="grid grid-cols-2 items-end gap-x-3 gap-y-1 border-t border-base-300 py-2"
              >
                <div className="col-span-2 flex items-center justify-between">
                  <span className="badge badge-neutral">TP{i + 1}</span>
                  {initial?.levels[i] && !levelsChanged && (
                    <span className="text-xs text-base-content/60">
                      {!telegramEnabled
                        ? "გამორთულია"
                        : initial.levels[i].reachedAt &&
                            !rearmed.includes(initial.levels[i].id ?? "")
                          ? "მიღწეულია"
                          : "ელოდება"}
                    </span>
                  )}
                  <button
                    className="btn btn-ghost btn-square min-h-11 min-w-11 text-error"
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
                <Field label="სამიზნე ფასი (USD)">
                  <input
                    className="input"
                    type={balancesHidden ? "password" : "text"}
                    value={level.price}
                    inputMode="decimal"
                    onChange={(e) => update(i, "price", e.target.value)}
                    placeholder="0.00"
                  />
                </Field>
                <Field label="გასაყიდი წილი (%)">
                  <input
                    className="input"
                    value={level.percentage}
                    inputMode="decimal"
                    onChange={(e) => update(i, "percentage", e.target.value)}
                  />
                </Field>
                <span className="numeric text-sm">
                  {result?.levels[i] ? (
                    <BalanceValue>
                      {quantity(result.levels[i].quantity)}{" "}
                      {position.asset.symbol}
                    </BalanceValue>
                  ) : (
                    "—"
                  )}
                </span>
                {telegramEnabled &&
                  (!initial?.levels[i]?.reachedAt ||
                    levelsChanged ||
                    rearmed.includes(initial.levels[i]?.id ?? "")) &&
                  position.quote &&
                  !position.quote.stale &&
                  (() => {
                    try {
                      return (
                        decimal(level.price).gt(0) &&
                        decimal(position.quote.price).gte(level.price)
                      );
                    } catch {
                      return false;
                    }
                  })() && (
                    <p className="col-span-2 text-xs text-warning">
                      ფასი უკვე სამიზნეზეა. ალერტი დაელოდება ქვემოთ დაბრუნებას
                      და ხელახალ მიღწევას.
                    </p>
                  )}
                {initial?.levels[i]?.reachedAt &&
                  initial.levels[i].id &&
                  !rearmed.includes(initial.levels[i].id!) &&
                  !levelsChanged &&
                  !preview && (
                    <button
                      className="btn btn-ghost col-span-2 justify-self-start"
                      disabled={pending}
                      onClick={async () => {
                        setPending(true);
                        try {
                          const reply = await rearmTakeProfit({
                            portfolioId,
                            assetId: position.assetId,
                            levelId: initial.levels[i].id,
                          });
                          setError(!reply.ok);
                          setMessage(
                            reply.ok
                              ? "ალერტი ხელახლა ჩართულია."
                              : reply.error!,
                          );
                          if (reply.ok) {
                            setRearmed((v) => [...v, initial.levels[i].id!]);
                            router.refresh();
                          }
                        } catch {
                          setError(true);
                          setMessage("ალერტის ჩართვა ვერ მოხერხდა.");
                        } finally {
                          setPending(false);
                        }
                      }}
                    >
                      ხელახალი ჩართვა
                    </button>
                  )}
                <span className="numeric text-sm">
                  {result?.levels[i] ? (
                    <BalanceValue>
                      {money(result.levels[i].revenue)}
                    </BalanceValue>
                  ) : (
                    "—"
                  )}
                </span>
              </div>
            ))}
          </div>
          <div className="card-actions">
            <button
              className="btn btn-outline"
              disabled={levels.length >= 12}
              onClick={() =>
                setLevels((l) => [...l, { price: "", percentage: "10" }])
              }
            >
              <Plus size={15} />
              ეტაპის დამატება
            </button>
            {!preview && (
              <button
                className="btn btn-primary"
                disabled={!result || pending}
                onClick={async () => {
                  setPending(true);
                  try {
                    const response = await saveExitPlan({
                      portfolioId,
                      assetId: position.assetId,
                      feePercent,
                      levels,
                      telegramEnabled,
                    });
                    setError(!response.ok);
                    if (response.ok) {
                      window.dispatchEvent(new Event("ccx-planning-saved"));
                      router.refresh();
                    }
                    setMessage(
                      response.ok ? "გასვლის გეგმა შენახულია." : response.error,
                    );
                  } catch {
                    setError(true);
                    setMessage("შენახვა ვერ მოხერხდა.");
                  } finally {
                    setPending(false);
                  }
                }}
              >
                {pending ? "ინახება…" : "გეგმის შენახვა"}
              </button>
            )}
          </div>
        </div>
      </section>
      {result ? (
        <aside className="grid gap-3 lg:gap-4 xl:grid-cols-2">
          <div className="grid grid-cols-2 gap-2 bg-base-100">
            <Metric
              compact
              label="მოსალოდნელი წმინდა შემოსავალი"
              value={money(result.revenue)}
              sensitive
            />
            <Metric
              compact
              label="მოსალოდნელი მოგება"
              value={money(position.costBasis === null ? null : result.profit)}
              sensitive
            />
            <Metric
              compact
              label="დარჩენილი პოზიცია"
              value={`${quantity(result.remainingQuantity)} ${position.asset.symbol}`}
              sensitive
            />
            <Metric
              compact
              label="საშუალო წმინდა გასვლის ფასი"
              value={money(result.weightedExitPrice)}
              sensitive
            />
          </div>
          <section className="border-t border-base-300 pt-3">
            <h2 className="text-base font-medium">კაპიტალის ამოღება</h2>
            <p className="mt-3 text-xs leading-5 text-base-content/60">
              აღსადგენი თვითღირებულება:{" "}
              <BalanceValue>{money(position.costBasis)}</BalanceValue>.{" "}
              {position.costBasis === null ? (
                "თვითღირებულება უცნობია; კაპიტალის ამოღება არ გამოითვლება."
              ) : result.alreadyRecovered ? (
                "დარჩენილ პოზიციას ნულოვანი თვითღირებულება აქვს."
              ) : result.recoveryLevel ? (
                <>
                  კაპიტალი სრულად ამოიღება TP{result.recoveryLevel} ეტაპზე, ამ
                  ეტაპის{" "}
                  <BalanceValue>
                    {quantity(result.recoveryQuantity!)}
                  </BalanceValue>{" "}
                  {position.asset.symbol}-ის გაყიდვის შემდეგ.
                </>
              ) : (
                "მოცემული ეტაპებით საწყისი თვითღირებულება სრულად ვერ ამოიღება."
              )}{" "}
              დარჩება პოზიციის {percentage(result.remainingPercent)}.
            </p>
            <div className="mt-3 divide-y divide-base-300">
              {result.levels.map((l, i) => (
                <div
                  key={i}
                  className="flex flex-wrap justify-between gap-3 py-3 text-xs"
                >
                  <span className="text-primary">
                    TP{i + 1} ·{" "}
                    <BalanceValue>{quantity(l.quantity)}</BalanceValue>{" "}
                    {position.asset.symbol}
                  </span>
                  <span>
                    შემოსავალი: <BalanceValue>{money(l.revenue)}</BalanceValue>
                  </span>
                  <span className="text-base-content/60">
                    მოგება:{" "}
                    <BalanceValue>
                      {money(position.costBasis === null ? null : l.profit)}
                    </BalanceValue>
                  </span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      ) : (
        <Message>
          შეიყვანეთ ზრდადი დადებითი ფასები. წილების ჯამი არ უნდა აღემატებოდეს
          100%-ს. უცნობი თვითღირებულებისას მოგება არ გამოითვლება.
        </Message>
      )}
      {message && <Message error={error}>{message}</Message>}
    </div>
  );
}
