"use client";
import { useState } from "react";
import { Activity, ChartNoAxesCombined, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react";
import type { Asset, LedgerEntry, PortfolioSummary } from "@/domain/types";
import {
  analyzeHealth,
  analyzePerformance,
  type Snapshot,
} from "@/domain/analytics";
import { calculatePortfolioAttribution } from "@/domain/attribution";
import { replayLedger } from "@/domain/ledger";
import { percentage, money, pnlClass } from "@/lib/formatters";
import { HistoryChart } from "./history-chart";
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
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface p-3">
        <div>
          <p className="text-sm font-semibold">შედეგების ანალიზი</p>
          <p className="mt-1 text-[11px] text-muted">პორტფელის შედეგი, რისკი და attribution</p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg bg-raised/60 p-1">
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
            className={`min-h-10 rounded-lg border px-3 py-2 text-xs font-medium ${period === value ? "border-brand/30 bg-brand/15 text-brand" : "border-transparent text-muted hover:bg-raised hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AnalyticsMetric icon={<TrendingUp size={18}/>} label="პერიოდის შემოსავლიანობა" value={percentage(performance.returnPercent, true)} tone="brand" result={performance.returnPercent} />
        <AnalyticsMetric icon={<TrendingDown size={18}/>} label="მაქსიმალური ვარდნა" value={percentage(performance.maxDrawdown)} tone="brand" result={performance.maxDrawdown} />
        <AnalyticsMetric icon={<ChartNoAxesCombined size={18}/>} label="რეალიზებული P&L" value={money(summary.realizedPnl)} tone="brand" result={summary.realizedPnl} />
        <AnalyticsMetric icon={<Activity size={18}/>} label="არარეალიზებული P&L" value={money(summary.unrealizedPnl)} tone="brand" result={summary.unrealizedPnl} />
      </div>
      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-line p-5">
          <div><h2 className="text-sm font-semibold">ღირებულების ისტორია</h2><p className="mt-1 text-[10px] text-muted">არჩეული პერიოდის პორტფელის დინამიკა</p></div>
          <span className="rounded-md border border-line px-2 py-1 text-xs text-muted">შენახული ისტორია</span>
        </div>
        <div className="p-5">
        <HistoryChart snapshots={selected} showPeriodControls={false} />
        <p className="mt-5 text-[11px] leading-6 text-muted">
          შემოსავლიანობა და ვარდნა მიახლოებითი შეფასებებია: ყოველდღიური
          მონაცემები თანხის შეტანა-გატანის გათვალისწინებით მუშავდება (Modified
          Dietz). აქტივის გადატანის ან ისტორიის მნიშვნელოვანი გამოტოვების
          შემთხვევაში შეფასება არ გამოითვლება. ღირებულების გრაფიკი თანხის
          შეტანებსაც ასახავს.
        </p>
        </div>
      </section>
      <PerformanceAttribution attribution={attribution} />
      <section className="panel overflow-hidden">
        <div className="border-b border-line p-5"><h2 className="text-sm font-semibold">პორტფელის მდგომარეობა</h2><p className="mt-1 text-[10px] text-muted">კონცენტრაციისა და რეზერვის სწრაფი კონტროლი</p></div>
        <div className="p-5">
        {health ? (
          <>
            <div className="mt-1 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <AnalyticsMetric icon={<ShieldCheck size={17}/>}
                label="ყველაზე დიდი პოზიცია"
                value={percentage(health.largest)}
                tone="brand"
              />
              <AnalyticsMetric icon={<Activity size={17}/>}
                label="სამი უდიდესი პოზიციის წილი"
                value={percentage(health.topThree)}
                tone="brand"
              />
              <AnalyticsMetric icon={<TrendingUp size={17}/>}
                label="თანხა და სტეიბლკოინები"
                value={percentage(health.reserve)}
                tone="positive"
              />
              <AnalyticsMetric icon={<ChartNoAxesCombined size={17}/>}
                label="ეფექტური პოზიციების რაოდენობა"
                value={Number(health.effectivePositions).toFixed(2)}
                tone="brand"
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
        )}</div>
      </section>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="panel p-6">
          <AnalyticsMetric icon={<TrendingUp size={18}/>}
            label="საუკეთესო პოზიცია — დარჩენილი თვითღირებულების მიმართ"
            value={
              performers.length
                ? `${performers[0].asset.symbol} · ${percentage(performers[0].returnPercent, true)}`
                : "—"
            }
            tone="positive"
          />
        </div>
        <div className="panel p-6">
          <AnalyticsMetric icon={<TrendingDown size={18}/>}
            label="ყველაზე დაბალი შედეგი — დარჩენილი თვითღირებულების მიმართ"
            value={
              performers.length
                ? `${performers.at(-1)!.asset.symbol} · ${percentage(performers.at(-1)!.returnPercent, true)}`
                : "—"
            }
            tone="negative"
          />
        </div>
      </div>
    </div>
  );
}
function AnalyticsMetric({icon,label,value,tone,result}:{icon:React.ReactNode;label:string;value:string;tone:"positive"|"negative"|"brand";result?:string|null}) {
  const color=tone==="positive"?"text-positive bg-positive/10":tone==="negative"?"text-negative bg-negative/10":"text-brand bg-brand/10";
  return <article className="panel p-4"><span className={`flex size-9 items-center justify-center rounded-lg ${color}`}>{icon}</span><p className="mt-4 text-xs text-muted">{label}</p><p className={`numeric mt-1 text-lg font-semibold ${result === undefined ? "" : pnlClass(result)}`}>{value}</p></article>;
}
