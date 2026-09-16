import Link from "next/link";
import {
  ArrowUpRight,
  Wallet,
  ShieldCheck,
  ArrowDownLeft,
  CircleHelp,
  Landmark,
  TrendingUp,
  ChartNoAxesCombined,
} from "lucide-react";
import type { PortfolioSummary } from "@/domain/types";
import { money, percentage, pnlClass } from "@/lib/formatters";
import { percent } from "@/domain/decimal";
import { PositionsTable } from "./positions";

export function Overview({
  summary: s,
  base,
  preview = false,
  history,
}: {
  summary: PortfolioSummary;
  base: string;
  preview?: boolean;
  history?: React.ReactNode;
}) {
  const cashShare = s.value ? percent(s.cash, s.value) : null;
  const stablecoinShare =
    s.value && s.stablecoinValue !== null
      ? percent(s.stablecoinValue, s.value)
      : null;
  const liquidityShare =
    s.value && s.liquidity !== null ? percent(s.liquidity, s.value) : null;
  const largest = [...s.positions].sort(
    (a, b) => Number(b.value ?? 0) - Number(a.value ?? 0),
  )[0];
  return (
    <div className="space-y-6">
      {!s.complete && (
        <div
          role="status"
          className="rounded-lg border border-brand/25 bg-brand/5 p-4 text-xs leading-6 text-brand"
        >
          ზოგიერთი აქტივის ფასი მიუწვდომელია. სრული ღირებულება და მასზე
          დამოკიდებული მაჩვენებლები ფასების მიღების შემდეგ გამოჩნდება.
        </div>
      )}
      {s.stale && (
        <p role="status" className="text-xs text-muted">
          ნაჩვენებია ბოლო ხელმისაწვდომი ფასები. ზოგიერთი მათგანი 15 წუთზე
          ძველია.
        </p>
      )}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardMetric icon={<Wallet size={19} />} label="პორტფელის ღირებულება" value={money(s.value)} change="სრული პერიოდი" positive={s.totalPnl !== null && Number(s.totalPnl) >= 0} />
        <DashboardMetric icon={<TrendingUp size={19} />} label="არარეალიზებული მოგება" value={money(s.unrealizedPnl)} change="მიმდინარე შედეგი" positive={s.unrealizedPnl !== null && Number(s.unrealizedPnl) >= 0} />
        <DashboardMetric icon={<Landmark size={19} />} label="ნაღდი და სტეიბლები" value={money(s.liquidity)} change={percentage(liquidityShare)} positive />
        <DashboardMetric icon={<ChartNoAxesCombined size={19} />} label="აქტიური პოზიციები" value={String(s.positions.length).padStart(2, "0")} change={largest ? largest.asset.symbol + " უდიდესი წილი" : "პორტფელი ცარიელია"} positive />
      </section>
      <section className="panel overflow-hidden">
        <div>
          <div className="relative border-b border-line p-5 sm:p-7">
            <div className="flex items-center gap-2 text-xs text-muted">
              <Wallet size={15} />
              პორტფელის ღირებულება
            </div>
            <div className="numeric mt-4 text-4xl font-semibold tracking-[-.055em] sm:text-[46px]">
              {money(s.value)}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <span
                className={`rounded-md bg-white/4 px-2 py-1 text-xs ${pnlClass(s.totalPnl)}`}
              >
                {s.totalPnl && Number(s.totalPnl) > 0 ? "+" : ""}
                {money(s.totalPnl)}
              </span>
              <span className="text-[11px] text-muted">
                ჯამური მოგება / ზარალი
              </span>
            </div>
            <div className="absolute right-7 top-7 hidden size-10 items-center justify-center rounded-lg border border-brand/25 bg-brand/10 text-brand sm:flex">
              <ArrowUpRight size={18} />
            </div>
            <div className="mt-7 flex items-center gap-2 text-[10px] text-muted">
              <span className="size-1.5 rounded-full bg-brand" />
              {preview
                ? "სადემონსტრაციო მონაცემები"
                : s.positions.length
                  ? "შეფასება ბოლო ხელმისაწვდომი ფასებით"
                  : "დაიწყეთ თქვენი პირველი პოზიციით"}
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-y divide-line bg-raised/20 sm:grid-cols-4 sm:divide-y-0">
            <Metric
              label="ჯამური შეტანები"
              value={money(s.contributions)}
              hint="თანხა და აქტივების შეტანილი თვითღირებულება"
            />
            <Metric
              label="მიმდინარე თვითღირებულება"
              value={money(s.costBasis)}
              hint="დარჩენილი პოზიციების ღირებულებითი საფუძველი"
            />
            <Metric
              label="არარეალიზებული მოგება / ზარალი"
              value={money(s.unrealizedPnl)}
              tone={pnlClass(s.unrealizedPnl)}
            />
            <Metric
              label="რეალიზებული მოგება / ზარალი"
              value={money(s.realizedPnl)}
              tone={pnlClass(s.realizedPnl)}
            />
          </div>
        </div>
      </section>
      <div className="grid gap-6 xl:grid-cols-[1.65fr_1fr]">
        <section className="panel min-w-0 p-6 sm:p-7">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium">პორტფელის დინამიკა</h2>
              <p className="mt-1.5 text-[11px] text-muted">
                ღირებულების ცვლილება დროში
              </p>
            </div>
            <span className="rounded-md border border-line px-2.5 py-1 text-[10px] text-muted">
              USD
            </span>
          </div>
          {history ?? (
            <div className="flex h-52 flex-col items-center justify-center rounded-lg border border-dashed border-line text-center">
              <ArrowDownLeft size={23} className="mb-3 text-brand" />
              <p className="text-xs text-muted">
                ისტორია ჯერ არ არის დაგროვებული
              </p>
              <p className="mt-2 max-w-xs text-[11px] leading-5 text-muted">
                გრაფიკი გამოჩნდება რეალური ისტორიული მონაცემების დაგროვების
                შემდეგ.
              </p>
            </div>
          )}
        </section>
        <section className="panel p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">აქტივების განაწილება</h2>
            <Link
              href={`${base}/allocation`}
              className="text-muted hover:text-brand"
              aria-label="განაწილების ნახვა"
            >
              <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="my-6">
            <div className="flex items-end justify-between gap-4">
            <div>
              <p className="numeric text-3xl font-medium">
                {s.positions.length.toString().padStart(2, "0")}
              </p>
              <p className="mt-1 text-[11px] text-muted">აქტიური პოზიცია</p>
              <p className="mt-4 text-[11px] text-muted">საერთო ლიკვიდობა</p>
              <p className="numeric mt-1 text-sm">{money(s.liquidity)}</p>
              <p className="numeric mt-1 text-[10px] text-muted">
                {percentage(liquidityShare)}
              </p>
            </div><p className="numeric text-sm text-muted">{percentage(liquidityShare)}</p></div>
            <AllocationBar summary={s} />
          </div>
          <div className="mb-5 grid grid-cols-2 gap-2">
            <LiquidityMetric
              label="ნაღდი ფული"
              value={s.cash}
              share={cashShare}
              tone="bg-[var(--grey)]"
            />
            <LiquidityMetric
              label="სტეიბლკოინები"
              value={s.stablecoinValue}
              share={stablecoinShare}
              tone="bg-[var(--teal)]"
            />
          </div>
          <div className="space-y-3">
            {s.positions.slice(0, 3).map((p, i) => (
              <div
                key={p.assetId}
                className="flex items-center justify-between text-xs"
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: ["var(--gold)", "var(--violet)", "var(--green)"][i] }}
                  />
                  {p.asset.symbol}
                </span>
                <span className="numeric text-muted">
                  {percentage(p.allocation)}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="panel">
        <div className="flex items-center justify-between px-6 pt-6 pb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-medium">თქვენი პოზიციები</h2>
            <span className="rounded-md bg-raised px-2 py-0.5 text-[10px] text-muted">
              {s.positions.length}
            </span>
          </div>
          <Link
            href={`${base}/positions`}
            className="flex items-center gap-1 text-[11px] text-brand"
          >
            ყველას ნახვა <ArrowUpRight size={13} />
          </Link>
        </div>
        <PositionsTable positions={s.positions} base={base} preview={preview} />
      </section>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-start gap-4 rounded-xl border border-line p-5">
          <ShieldCheck size={20} className="mt-1 shrink-0 text-brand" />
          <div>
            <h3 className="text-xs font-medium">კონცენტრაციის მონიტორინგი</h3>
            <p className="mt-2 text-xs leading-6 text-muted">
              {largest
                ? `${largest.asset.symbol} პორტფელის ${percentage(largest.allocation)}-ს შეადგენს. განაწილების ცვლილება აქვე აისახება.`
                : "პოზიციების დამატების შემდეგ აქ გამოჩნდება ყველაზე დიდი პოზიციის წილი."}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-4 rounded-xl border border-line p-5">
          <CircleHelp size={20} className="mt-1 shrink-0 text-brand" />
          <div>
            <h3 className="text-xs font-medium">ერთი პორტფელი, სრული სურათი</h3>
            <p className="mt-2 text-xs leading-6 text-muted">
              შესყიდვები, გაყიდვები და საკომისიოები საერთო ისტორიაში ინახება.
              გამოთვლები ამ მონაცემებს ეყრდნობა.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
function LiquidityMetric({
  label,
  value,
  share,
  tone,
}: {
  label: string;
  value: string | null;
  share: string | null;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-raised/35 p-3">
      <p className="flex items-center gap-2 text-[10px] text-muted">
        <span className={`size-1.5 rounded-full ${tone}`} />
        {label}
      </p>
      <p className="numeric mt-2 text-sm font-medium">{money(value)}</p>
      <p className="numeric mt-1 text-[10px] text-muted">{percentage(share)}</p>
    </div>
  );
}
export function Metric({
  label,
  value,
  hint,
  tone = "text-foreground",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0 p-5 sm:p-6">
      <p className="max-w-48 text-[11px] leading-5 text-muted" title={hint}>
        {label}
      </p>
      <p className={`numeric mt-2 text-xl font-medium sm:text-2xl ${tone}`}>
        {value}
      </p>
    </div>
  );
}
function AllocationBar({summary}:{summary:PortfolioSummary}){const colors=["var(--gold)","var(--violet)","var(--green)","var(--blue)","var(--teal)"];const cash=summary.value?Number(percent(summary.cash,summary.value)??0):0;return <div className="mt-5 flex h-2.5 overflow-hidden rounded-sm border border-line bg-raised" aria-label="აქტივების განაწილება">{summary.positions.map((p,i)=><span key={p.assetId} style={{width:`${p.allocation??0}%`,background:colors[i%colors.length]}} title={`${p.asset.symbol} ${percentage(p.allocation)}`}/>)}<span style={{width:`${cash}%`,background:"var(--grey)"}} title={`ნაღდი ფული ${percentage(String(cash))}`}/></div>}
function DashboardMetric({icon,label,value,change,positive}:{icon:React.ReactNode;label:string;value:string;change:string;positive:boolean}) {
  return <article className="panel p-4 sm:p-5"><span className="flex size-10 items-center justify-center rounded-xl bg-raised text-brand">{icon}</span><div className="mt-4 flex items-end justify-between gap-3"><div className="min-w-0"><p className="text-[11px] text-muted">{label}</p><p className="numeric mt-1.5 whitespace-nowrap text-lg font-semibold tracking-[-.05em]">{value}</p></div><span className={positive ? "shrink-0 rounded-full bg-positive/12 px-2 py-1 text-[10px] font-medium text-positive" : "shrink-0 rounded-full bg-negative/12 px-2 py-1 text-[10px] font-medium text-negative"}>{change}</span></div></article>
}
