"use client";
import { useState } from "react";
import type { Asset, LedgerEntry, PortfolioSummary } from "@/domain/types";
import {
  analyzeHealth,
  analyzePerformance,
  type Snapshot,
} from "@/domain/analytics";
import { calculatePortfolioAttribution } from "@/domain/attribution";
import { replayLedger } from "@/domain/ledger";
import { percentage, money } from "@/lib/formatters";
import { HistoryChart } from "./history-chart";
import { Metric } from "./overview";
import { PerformanceAttribution } from "./performance-attribution";
export function Analytics({
  summary,
  snapshots,
  entries,
  assets,
}: {
  summary: PortfolioSummary;
  snapshots: Snapshot[];
  entries: LedgerEntry[];
  assets: Asset[];
}) {
  const [period, setPeriod] = useState("all");
  const latest = snapshots.length
    ? Date.parse(snapshots[snapshots.length - 1].capturedAt)
    : 0;
  const selected =
    period === "all"
      ? snapshots
      : snapshots.filter(
          (s) => Date.parse(s.capturedAt) >= latest - Number(period) * 86400000,
        );
  const performance = analyzePerformance(selected, entries),
    health = analyzeHealth(summary),
    attribution = calculatePortfolioAttribution(
      replayLedger(entries),
      summary,
      assets,
    );
  const performers = [...summary.positions]
    .filter((p) => p.returnPercent !== null)
    .sort((a, b) => Number(b.returnPercent) - Number(a.returnPercent));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {[
          ["1", "24 საათი"],
          ["7", "7 დღე"],
          ["30", "30 დღე"],
          ["90", "3 თვე"],
          ["365", "1 წელი"],
          ["all", "სრული პერიოდი"],
        ].map(([value, label]) => (
          <button
            key={value}
            aria-pressed={period === value}
            onClick={() => setPeriod(value)}
            className={`rounded-lg border px-3 py-2 text-xs ${period === value ? "border-brand/40 bg-brand/10 text-brand" : "border-line text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="panel grid grid-cols-2 gap-6 p-6 lg:grid-cols-4">
        <Metric
          label="პერიოდის სავარაუდო შემოსავლიანობა"
          value={percentage(performance.returnPercent, true)}
        />
        <Metric
          label="სავარაუდო მაქსიმალური ვარდნა"
          value={percentage(performance.maxDrawdown)}
        />
        <Metric
          label="რეალიზებული მოგება / ზარალი (სრული ისტორია)"
          value={money(summary.realizedPnl)}
        />
        <Metric
          label="არარეალიზებული მოგება / ზარალი"
          value={money(summary.unrealizedPnl)}
        />
      </div>
      <section className="panel p-6">
        <h2 className="mb-5 text-sm font-medium">ღირებულების ისტორია</h2>
        <HistoryChart snapshots={selected} />
        <p className="mt-5 text-[11px] leading-6 text-muted">
          შემოსავლიანობა და ვარდნა მიახლოებითი შეფასებებია: ყოველდღიური
          მონაცემები თანხის შეტანა-გატანის გათვალისწინებით მუშავდება (Modified
          Dietz). აქტივის გადატანის ან ისტორიის მნიშვნელოვანი გამოტოვების
          შემთხვევაში შეფასება არ გამოითვლება. ღირებულების გრაფიკი თანხის
          შეტანებსაც ასახავს.
        </p>
      </section>
      <PerformanceAttribution attribution={attribution} />
      <section className="panel p-6">
        <h2 className="text-sm font-medium">პორტფელის მდგომარეობა</h2>
        {health ? (
          <>
            <div className="mt-6 grid grid-cols-2 gap-6 lg:grid-cols-4">
              <Metric
                label="ყველაზე დიდი პოზიცია"
                value={percentage(health.largest)}
              />
              <Metric
                label="სამი უდიდესი პოზიციის წილი"
                value={percentage(health.topThree)}
              />
              <Metric
                label="თანხა და სტეიბლკოინები"
                value={percentage(health.reserve)}
              />
              <Metric
                label="ეფექტური პოზიციების რაოდენობა"
                value={Number(health.effectivePositions).toFixed(2)}
              />
            </div>
            <p className="mt-6 rounded-lg bg-raised p-4 text-xs leading-7">
              <span className="text-brand">
                კონცენტრაცია:{" "}
                {health.concentration === "high"
                  ? "მაღალი"
                  : health.concentration === "medium"
                    ? "საშუალო"
                    : "დაბალი"}
                .
              </span>{" "}
              {health.largestSymbol} პორტფელის {percentage(health.largest)}-ს
              შეადგენს.
            </p>
            <p className="mt-4 text-[11px] leading-6 text-muted">
              კონცენტრაციის საზღვრები: 30%-ზე ნაკლები — დაბალი; 30–50% —
              საშუალო; 50%-დან — მაღალი. ეფექტური რაოდენობა წილების კვადრატების
              ჯამის შებრუნებული მნიშვნელობაა და USD-ის ნაშთსაც მოიცავს. ეს
              მაჩვენებლები პორტფელის სტრუქტურას აღწერს და ფასების ცვლილებას არ
              პროგნოზირებს. სტეიბლკოინებსაც აქვთ რისკი.
            </p>
          </>
        ) : (
          <p className="mt-6 text-xs leading-6 text-muted">
            შეფასებისთვის საჭიროა დადებითი ღირებულება და ყველა აქტივის
            განახლებული ფასი.
          </p>
        )}
      </section>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="panel p-6">
          <Metric
            label="საუკეთესო პოზიცია — დარჩენილი თვითღირებულების მიმართ"
            value={
              performers.length
                ? `${performers[0].asset.symbol} · ${percentage(performers[0].returnPercent, true)}`
                : "—"
            }
          />
        </div>
        <div className="panel p-6">
          <Metric
            label="ყველაზე დაბალი შედეგი — დარჩენილი თვითღირებულების მიმართ"
            value={
              performers.length
                ? `${performers.at(-1)!.asset.symbol} · ${percentage(performers.at(-1)!.returnPercent, true)}`
                : "—"
            }
          />
        </div>
      </div>
    </div>
  );
}
