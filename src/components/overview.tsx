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
import { AssetIcon, PositionsTable } from "./positions";

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
      <section className="overview-stage grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_390px]">
      <section className="order-2 grid content-start gap-3 sm:grid-cols-2 xl:grid-cols-2">
        <DashboardMetric icon={<Wallet size={19} />} label="პორტფელის ღირებულება" value={money(s.value)} change="სრული პერიოდი" positive={s.totalPnl !== null && Number(s.totalPnl) >= 0} />
        <DashboardMetric icon={<TrendingUp size={19} />} label="არარეალიზებული მოგება" value={money(s.unrealizedPnl)} change="მიმდინარე შედეგი" positive={s.unrealizedPnl !== null && Number(s.unrealizedPnl) >= 0} />
        <DashboardMetric icon={<Landmark size={19} />} label="ნაღდი და სტეიბლები" value={money(s.liquidity)} change={percentage(liquidityShare)} positive />
        <DashboardMetric icon={<ChartNoAxesCombined size={19} />} label="აქტიური პოზიციები" value={String(s.positions.length).padStart(2, "0")} change={largest ? largest.asset.symbol + " უდიდესი წილი" : "პორტფელი ცარიელია"} positive />
      </section>
      <section className="panel signal-hero order-1 overflow-hidden">
        <div>
          <div className="relative min-h-[286px] border-b border-line p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-muted">
                <span className="grid size-8 place-items-center rounded-xl border border-brand/25 bg-brand/10 text-brand"><Wallet size={15} /></span>
                Track. Analyze. Grow.
              </div>
              <span className="rounded-full border border-positive/25 bg-positive/10 px-2.5 py-1 text-[10px] font-semibold text-positive">Live valuation</span>
            </div>
            <p className="mt-8 text-[11px] font-medium uppercase tracking-[.18em] text-muted">სრული პორტფელის ღირებულება · თქვენი კრიპტო ხედვა</p>
            <div className="numeric mt-2 text-5xl font-semibold tracking-[-.07em] sm:text-[58px]">
              {money(s.value)}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <span
                className={`rounded-full bg-raised px-3 py-1.5 text-xs font-semibold ${pnlClass(s.totalPnl)}`}
              >
                {s.totalPnl && Number(s.totalPnl) > 0 ? "+" : ""}
                {money(s.totalPnl)}
              </span>
              <span className="text-[11px] text-muted">
                ყველა დროის შედეგი
              </span>
            </div>
            <div className="absolute right-7 top-7 hidden size-10 items-center justify-center rounded-xl border border-brand/25 bg-brand/10 text-brand sm:flex">
              <ArrowUpRight size={18} />
            </div>
            <div className="mt-9 flex items-center gap-2 text-[10px] text-muted">
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
        <PortfolioAllocation
          summary={s}
          base={base}
          cashShare={cashShare}
          stablecoinShare={stablecoinShare}
          liquidityShare={liquidityShare}
        />
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
function PortfolioAllocation({ summary, base, cashShare, stablecoinShare, liquidityShare }: { summary: PortfolioSummary; base: string; cashShare: string | null; stablecoinShare: string | null; liquidityShare: string | null }) {
  const positions = [...summary.positions].sort((a, b) => Number(b.allocation ?? 0) - Number(a.allocation ?? 0));
  const colors = ["var(--gold)", "var(--violet)", "var(--teal)", "var(--green)", "var(--blue)"];
  const cash = summary.value ? Number(percent(summary.cash, summary.value) ?? 0) : 0;
  return <section className="panel allocation-map overflow-hidden">
    <div className="flex items-center justify-between border-b border-line px-5 py-4">
      <div><p className="eyebrow">პორტფელის რუკა</p><h2 className="mt-1 text-sm font-semibold">აქტივების განაწილება</h2></div>
      <Link href={`${base}/allocation`} className="flex items-center gap-1 rounded-md border border-line px-2 py-1.5 text-[10px] text-muted hover:bg-raised hover:text-foreground">სრულად <ArrowUpRight size={13} /></Link>
    </div>
    <div className="p-5">
      <div className="rounded-lg border border-line bg-raised/35 p-4">
        <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] text-muted">დომინანტი პოზიცია</p><p className="mt-1 text-lg font-semibold">{positions[0]?.asset.symbol ?? "—"}</p></div><span className="numeric rounded-md bg-surface px-2 py-1 text-xs text-brand">{percentage(positions[0]?.allocation ?? null)}</span></div>
        <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-surface" aria-label="აქტივების განაწილება">
          {positions.map((position, index) => <span key={position.assetId} title={`${position.asset.symbol} ${percentage(position.allocation)}`} style={{ width: `${position.allocation ?? 0}%`, background: colors[index % colors.length] }} />)}
          <span title={`ნაღდი ფული ${percentage(String(cash))}`} style={{ width: `${cash}%`, background: "var(--grey)" }} />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-line p-3"><p className="text-[10px] text-muted">ნაღდი ფული</p><p className="numeric mt-1 text-sm font-medium">{money(summary.cash)}</p><p className="numeric mt-1 text-[10px] text-muted">{percentage(cashShare)}</p></div>
        <div className="rounded-lg border border-line p-3"><p className="text-[10px] text-muted">სტეიბლკოინები</p><p className="numeric mt-1 text-sm font-medium">{money(summary.stablecoinValue)}</p><p className="numeric mt-1 text-[10px] text-muted">{percentage(stablecoinShare)}</p></div>
      </div>
      <div className="mt-5 flex items-center justify-between"><p className="text-[11px] font-medium">ტოპ პოზიციები</p><span className="numeric text-[10px] text-muted">ლიკვიდობა {percentage(liquidityShare)}</span></div>
      <div className="mt-3 space-y-3">
        {positions.slice(0, 4).map((position, index) => <div key={position.assetId} className="group"><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><AssetIcon symbol={position.asset.symbol} logoUrl={position.asset.logoUrl} index={index} /><span className="text-xs font-medium">{position.asset.symbol}</span></div><div className="text-right"><p className="numeric text-xs">{percentage(position.allocation)}</p><p className="numeric mt-0.5 text-[9px] text-muted">{money(position.value)}</p></div></div><div className="mt-2 h-1 overflow-hidden rounded-full bg-raised"><div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${position.allocation ?? 0}%`, background: colors[index % colors.length] }} /></div></div>)}
      </div>
    </div>
  </section>;
}
function DashboardMetric({icon,label,value,change,positive}:{icon:React.ReactNode;label:string;value:string;change:string;positive:boolean}) {
  return <article className="panel signal-card p-4 sm:p-5"><div className="flex items-center justify-between"><span className="flex size-10 items-center justify-center rounded-xl border border-line bg-raised text-brand">{icon}</span><span className={positive ? "rounded-full bg-positive/10 px-2.5 py-1 text-[10px] font-semibold text-positive" : "rounded-full bg-negative/10 px-2.5 py-1 text-[10px] font-semibold text-negative"}>{change}</span></div><div className="mt-5"><p className="text-[11px] text-muted">{label}</p><p className="numeric mt-1.5 whitespace-nowrap text-lg font-semibold tracking-[-.05em]">{value}</p></div></article>
}
