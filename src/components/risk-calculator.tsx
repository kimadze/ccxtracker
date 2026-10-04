"use client";
import { useState } from "react";
import {
  calculateRisk,
  type RiskInputs,
  type RiskField,
} from "@/domain/risk-calculator";
import { decimal } from "@/domain/decimal";
import { money, percentage, quantity } from "@/lib/formatters";
import { BalanceValue, Field } from "./ui";

const initial: RiskInputs = {
  accountBalance: "10000",
  direction: "LONG",
  entryPrice: "100000",
  stopLoss: "99000",
  takeProfit: "102500",
  riskPercent: "0.50",
  leverage: "5",
};
const fields = [
  ["accountBalance", "ანგარიშის ბალანსი (USD)"],
  ["entryPrice", "Entry ფასი (USD)"],
  ["stopLoss", "Stop Loss (USD)"],
  ["takeProfit", "Take Profit (USD)"],
  ["riskPercent", "რისკი თითო გარიგებაზე (%)"],
  ["leverage", "ლევერიჯი (x)"],
] as const;
export function RiskCalculator() {
  const [input, setInput] = useState<RiskInputs>(initial);
  const calculation = calculateRisk(input);
  const update = (key: RiskField, value: string) =>
    setInput((previous) => ({ ...previous, [key]: value }));
  const result = calculation.ok ? calculation.result : null;
  const outputs = result
    ? [
        ["რისკის თანხა", money(result.riskAmount)],
        ["პოზიციის ზომა", money(result.positionSize)],
        ["რაოდენობა", quantity(result.quantity)],
        ["Stop მანძილი", percentage(result.stopDistancePercent)],
        ["საჭირო მარჟა", money(result.requiredMargin)],
        ["პოტენციური ზარალი", money(result.potentialLoss)],
        ["პოტენციური მოგება", money(result.potentialProfit)],
        [
          "Risk / Reward",
          "1:" + decimal(result.riskReward).toDecimalPlaces(4).toFixed(),
        ],
      ]
    : [];
  return (
    <div className="grid min-w-0 items-start gap-3 lg:grid-cols-2 lg:gap-4">
      <section className="card card-border min-w-0 bg-base-200">
        <div className="card-body gap-3 p-4">
          <fieldset className="fieldset">
            <legend className="fieldset-legend">გარიგების მიმართულება</legend>
            <div
              className="join"
              role="group"
              aria-label="გარიგების მიმართულება"
            >
              {(["LONG", "SHORT"] as const).map((direction) => (
                <button
                  key={direction}
                  type="button"
                  aria-pressed={input.direction === direction}
                  className={
                    "btn join-item min-h-11 " +
                    (input.direction === direction
                      ? "btn-primary"
                      : "btn-outline")
                  }
                  onClick={() => update("direction", direction)}
                >
                  {direction}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            {fields.map(([key, label]) => {
              const error = calculation.ok
                ? undefined
                : calculation.errors[key];
              return (
                <div key={key} className="min-w-0">
                  <Field label={label}>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={input[key]}
                      aria-invalid={!!error}
                      aria-describedby={error ? "risk-error-" + key : undefined}
                      onChange={(event) => update(key, event.target.value)}
                    />
                  </Field>
                  {error && (
                    <p
                      id={"risk-error-" + key}
                      className="mt-1 text-xs text-error"
                    >
                      {error}
                    </p>
                  )}
                  {key === "riskPercent" && (
                    <div
                      className="mt-2 flex flex-wrap gap-1"
                      role="group"
                      aria-label="სწრაფი რისკი"
                    >
                      {["0.25", "0.50", "0.75", "1.00"].map((risk) => (
                        <button
                          key={risk}
                          type="button"
                          className={
                            "btn btn-sm min-h-11 " +
                            (input.riskPercent === risk
                              ? "btn-soft btn-primary"
                              : "btn-ghost")
                          }
                          aria-pressed={input.riskPercent === risk}
                          onClick={() => update("riskPercent", risk)}
                        >
                          {risk}%
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <section
        className="card card-border min-w-0 bg-base-200"
        aria-label="გამოთვლის შედეგი"
      >
        <div className="card-body gap-3 p-4">
          <h2 className="text-sm font-semibold">შედეგი</h2>
          {result ? (
            <dl className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
              {outputs.map(([label, value]) => (
                <div
                  key={label}
                  className="stat min-w-0 rounded-box border border-base-300 bg-base-100 p-3"
                >
                  <dt className="stat-title whitespace-normal text-xs">
                    {label}
                  </dt>
                  <dd className="stat-value min-w-0 overflow-x-auto whitespace-nowrap text-xl tabular-nums">
                    <BalanceValue>{value}</BalanceValue>
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p role="status" className="text-sm text-base-content/60">
              შეასწორეთ ველები შედეგის სანახავად.
            </p>
          )}
          {result &&
            decimal(result.requiredMargin).gt(
              decimal(input.accountBalance),
            ) && (
              <p role="status" className="alert alert-warning text-sm">
                საჭირო მარჟა აღემატება ანგარიშის ბალანსს.
              </p>
            )}
          <p className="text-xs text-base-content/60">
            USD შეფასება · რაოდენობა აქტივის ერთეულებში. საკომისიო და სლიპიჯი არ
            შედის.
          </p>
        </div>
      </section>
    </div>
  );
}
