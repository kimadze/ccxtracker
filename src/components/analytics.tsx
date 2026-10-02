"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  ChartNoAxesCombined,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { Asset, LedgerEntry, PortfolioSummary } from "@/domain/types";
import {
  analyzeHealth,
  analyzePerformance,
  type Snapshot,
} from "@/domain/analytics";
import { calculatePortfolioAttribution } from "@/domain/attribution";
import { replayLedger } from "@/domain/ledger";
import { percentage, pnlClass } from "@/lib/formatters";
import { HistoryChart } from "./history-chart";
import { PerformanceAttribution } from "./performance-attribution";
import { isInvestableCrypto } from "@/domain/portfolio-segments";
export function Analytics({
  summary,
  snapshots,
  entries,
  assets,
  portfolioId,
}: {
  summary: PortfolioSummary;
  snapshots: Snapshot[];
  entries: LedgerEntry[];
  assets: Asset[];
  portfolioId: string;
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
    .filter((p) => isInvestableCrypto(p.asset) && p.returnPercent !== null)
    .sort((a, b) => Number(b.returnPercent) - Number(a.returnPercent));
  const hasHistory = snapshots.length > 0;
  return (
    <div className="space-y-3 lg:space-y-4">
      <section className="card card-border bg-base-200">
        <div className="card-body gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <p className="text-sm font-semibold">შედეგების ანალიზი</p>
            <p className="mt-1 text-xs text-base-content/60">
              პორტფელის შედეგი, რისკი და attribution
            </p>
          </div>
          <div className="tabs tabs-box flex min-w-0 max-w-full flex-nowrap overflow-x-auto">
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
                className={`tab min-h-11 shrink-0 ${period === value ? "tab-active" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>
      <div className="grid grid-cols-2 gap-px rounded-box border border-base-300 bg-base-200">
        <AnalyticsMetric
          icon={<TrendingUp size={18} />}
          label="პერიოდის შემოსავლიანობა"
          value={percentage(performance.returnPercent, true)}
          tone="brand"
          result={performance.returnPercent}
        />
        <AnalyticsMetric
          icon={<TrendingDown size={18} />}
          label="მაქსიმალური ვარდნა"
          value={percentage(performance.maxDrawdown)}
          tone="brand"
          result={performance.maxDrawdown}
        />
      </div>
      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,7fr)_minmax(260px,3fr)] lg:gap-4">
        <div className="min-w-0 space-y-3">
          {hasHistory ? (
            <section className="card card-border overflow-hidden bg-base-200">
              <div className="flex items-center justify-between border-b border-base-300 p-5">
                <div>
                  <h2 className="text-sm font-semibold">ღირებულების ისტორია</h2>
                  <p className="mt-1 text-xs text-base-content/60">
                    არჩეული პერიოდის პორტფელის დინამიკა
                  </p>
                </div>
                <span className="badge badge-outline">შენახული ისტორია</span>
              </div>
              <div className="p-5">
                <HistoryChart
                  compact
                  snapshots={selected}
                  showPeriodControls={false}
                />
                <details className="collapse collapse-arrow mt-4 bg-base-100 text-xs leading-6">
                  <summary className="collapse-title font-medium">
                    გამოთვლის შესახებ
                  </summary>
                  <p className="collapse-content text-base-content/60">
                    შემოსავლიანობა და ვარდნა მიახლოებითი შეფასებებია:
                    ყოველდღიური მონაცემები თანხის შეტანა-გატანის გათვალისწინებით
                    მუშავდება (Modified Dietz). აქტივის გადატანის ან ისტორიის
                    მნიშვნელოვანი გამოტოვების შემთხვევაში შეფასება არ
                    გამოითვლება. ღირებულების გრაფიკი თანხის შეტანებსაც ასახავს.
                  </p>
                </details>
              </div>
            </section>
          ) : (
            <section
              className="alert alert-info alert-soft sm:alert-horizontal"
              aria-label="პორტფელის ისტორიის სტატუსი"
            >
              <div>
                <span className="badge badge-info mb-2">პორტფელის ისტორია</span>
                <h2 className="font-semibold">
                  პირველი შეფასება ინახება ავტომატურად
                </h2>
                <p className="mt-1 text-sm leading-6">
                  ამ დროისთვის შენახული შეფასება არ მოიძებნა. შემდეგი ფასის
                  განახლება ამ პორტფელის ღირებულებას ავტომატურად დაამატებს
                  ისტორიაში.
                </p>
              </div>
              <span className="badge badge-success whitespace-nowrap">
                მონიტორინგი აქტიურია
              </span>
            </section>
          )}
          <PerformanceAttribution attribution={attribution} />
        </div>
        <div className="min-w-0 space-y-3">
          <section className="card card-border overflow-hidden bg-base-200">
            <div className="border-b border-base-300 p-5">
              <h2 className="text-sm font-semibold">პორტფელის მდგომარეობა</h2>
              <p className="mt-1 text-xs text-base-content/60">
                კონცენტრაციისა და რეზერვის სწრაფი კონტროლი
              </p>
            </div>
            <div className="p-5">
              {health ? (
                <>
                  <div className="grid grid-cols-2 gap-2 bg-base-100">
                    <AnalyticsMetric
                      icon={<ShieldCheck size={17} />}
                      label="ყველაზე დიდი პოზიცია"
                      value={percentage(health.largest)}
                      tone="brand"
                    />
                    <AnalyticsMetric
                      icon={<Activity size={17} />}
                      label="სამი უდიდესი პოზიციის წილი"
                      value={percentage(health.topThree)}
                      tone="brand"
                    />
                    <AnalyticsMetric
                      icon={<TrendingUp size={17} />}
                      label="თანხა და სტეიბლკოინები"
                      value={percentage(health.reserve)}
                      tone="positive"
                    />
                    <AnalyticsMetric
                      icon={<ChartNoAxesCombined size={17} />}
                      label="ეფექტური პოზიციების რაოდენობა"
                      value={Number(health.effectivePositions).toFixed(2)}
                      tone="brand"
                    />
                  </div>
                  <div
                    role="alert"
                    className="alert alert-info alert-soft mt-3 block text-xs leading-6"
                  >
                    <span>
                      კონცენტრაცია:{" "}
                      {health.concentration === "high"
                        ? "მაღალი"
                        : health.concentration === "medium"
                          ? "საშუალო"
                          : "დაბალი"}
                      .
                    </span>{" "}
                    {health.largestSymbol} პორტფელის{" "}
                    {percentage(health.largest)}-ს შეადგენს.
                  </div>
                  <details className="collapse collapse-arrow mt-3 bg-base-100 text-xs leading-6">
                    <summary className="collapse-title font-medium">
                      მაჩვენებლის განმარტება
                    </summary>
                    <p className="collapse-content text-base-content/60">
                      კონცენტრაცია და ეფექტური რაოდენობა ითვლება მხოლოდ
                      არასტეიბლ კრიპტოაქტივებით. Cash და სტეიბლკოინები ცალკე
                      ლიკვიდობად რჩება.
                    </p>
                  </details>
                </>
              ) : (
                <div
                  role="alert"
                  className="alert alert-info alert-soft mt-2 text-xs leading-6"
                >
                  შეფასებისთვის საჭიროა დადებითი ღირებულება და ყველა აქტივის
                  განახლებული ფასი.
                </div>
              )}
            </div>
          </section>
          {performers.length > 0 && (
            <div className="grid gap-3">
              <Link
                className="card card-border bg-success/5 transition hover:border-success"
                href={`/portfolios/${portfolioId}/positions/${performers[0].assetId}`}
              >
                <AnalyticsMetric
                  icon={<TrendingUp size={18} />}
                  label="საუკეთესო პოზიცია — დარჩენილი თვითღირებულების მიმართ"
                  value={
                    performers.length
                      ? `${performers[0].asset.symbol} · ${percentage(performers[0].returnPercent, true)}`
                      : "—"
                  }
                  tone="positive"
                />
              </Link>
              <Link
                className="card card-border bg-error/5 transition hover:border-error"
                href={`/portfolios/${portfolioId}/positions/${performers.at(-1)!.assetId}`}
              >
                <AnalyticsMetric
                  icon={<TrendingDown size={18} />}
                  label="ყველაზე დაბალი შედეგი — დარჩენილი თვითღირებულების მიმართ"
                  value={
                    performers.length
                      ? `${performers.at(-1)!.asset.symbol} · ${percentage(performers.at(-1)!.returnPercent, true)}`
                      : "—"
                  }
                  tone="negative"
                />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
function AnalyticsMetric({
  icon,
  label,
  value,
  tone,
  result,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "positive" | "negative" | "brand";
  result?: string | null;
}) {
  const color =
    tone === "positive"
      ? "text-success"
      : tone === "negative"
        ? "text-error"
        : "text-base-content";
  return (
    <article className="stat min-w-0">
      <div
        className={`stat-figure hidden xl:block ${color}`}
        aria-hidden="true"
      >
        {icon}
      </div>
      <div>
        <p className="stat-title whitespace-normal text-xs">{label}</p>
        <p
          className={`stat-value numeric mt-1 whitespace-normal text-lg ${result === undefined ? color : pnlClass(result)}`}
        >
          {value}
        </p>
      </div>
    </article>
  );
}
