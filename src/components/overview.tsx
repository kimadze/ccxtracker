import Link from "next/link";
import { Activity, AlertTriangle, ArrowUpRight, BarChart3, CircleDollarSign, PieChart, TrendingUp, Wallet } from "lucide-react";
import type { PortfolioSummary } from "@/domain/types";
import { decimal, percent } from "@/domain/decimal";
import { dateTime, money, percentage, pnlClass } from "@/lib/formatters";
import { AssetIcon } from "./positions";
import { BalanceValue } from "./ui";

export function Overview({ summary: s, base, portfolioName, cryptoOnlyValue = false, history, action }: {
  summary: PortfolioSummary; base: string; portfolioName: string; cryptoOnlyValue?: boolean; history?: React.ReactNode; action?: React.ReactNode;
}) {
  const positions = [...s.positions].sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0));
  const crypto = positions.filter((position) => !position.asset.isStablecoin && Number(position.value ?? 0) > 0);
  const cryptoTotal = crypto.reduce((sum, position) => sum.plus(position.value ?? 0), decimal(0));
  const displayedValue = cryptoOnlyValue ? cryptoTotal.toString() : (s.value ?? s.knownValue);
  const liquidityShare = s.value && s.liquidity !== null ? Number(percent(s.liquidity, s.value) ?? 0) : null;
  const netCapital = s.contributions !== null && s.withdrawals !== null ? decimal(s.contributions).minus(s.withdrawals).toString() : null;
  const quoteDates = positions.map((position) => position.quote?.updatedAt).filter((date): date is string => Boolean(date));
  const updatedAt = quoteDates.length ? quoteDates.sort().at(-1) : undefined;
  const freshness = positions.length === 0 ? "ფასის შეფასება ჯერ არ არის საჭირო" : s.stale ? "ფასების ნაწილი დაგვიანებულია" : s.complete ? "ფასები განახლებულია" : "ზოგი ფასი მიუწვდომელია";
  const largest = crypto[0];
  const palette = ["bg-warning", "bg-info", "bg-primary", "bg-accent", "bg-secondary"];
  const nextActions = [
    !s.complete ? { icon: <AlertTriangle size={18} />, title: "ფასის მონაცემები არასრულია", detail: "შეამოწმეთ აქტივები, რომელთაც მიმდინარე ფასი არ აქვთ.", href: `${base}/positions`, label: "პოზიციების ნახვა", tone: "alert-warning" } : null,
    s.complete && largest && Number(largest.allocation ?? 0) >= 35 ? { icon: <PieChart size={18} />, title: `${largest.asset.symbol} პორტფელის ${percentage(largest.allocation)}-ს შეადგენს`, detail: "შეადარეთ ეს წილი თქვენს მიზნობრივ განაწილებას.", href: `${base}/allocation`, label: "განაწილების ნახვა", tone: "alert-info" } : null,
    liquidityShare !== null && liquidityShare < 10 ? { icon: <Wallet size={18} />, title: "ლიკვიდობის წილი დაბალია", detail: `ქეში და სტეიბლკოინები პორტფელის ${percentage(String(liquidityShare))}-ს შეადგენს.`, href: `${base}/positions`, label: "პოზიციების მართვა", tone: "alert-warning" } : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  return <div className="space-y-6">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="breadcrumbs text-sm text-base-content/50"><ul><li>პორტფელი</li><li>{portfolioName}</li></ul></div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight lg:text-3xl">პორტფელის მიმოხილვა</h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-base-content/60"><span className={`status ${s.complete && !s.stale ? "status-success" : "status-warning"}`} /><span>{freshness}</span>{updatedAt && <span>· {dateTime(updatedAt)}</span>}</div>
      </div>
      <div className="flex flex-wrap gap-2">{action}<Link href={`${base}/positions`} className="btn">პოზიციების მართვა <ArrowUpRight size={16} /></Link></div>
    </header>

    {nextActions.length > 0 && <div className="grid gap-3 xl:grid-cols-3">{nextActions.map((item) => <div key={item.title} role="alert" className={`alert alert-soft ${item.tone}`}>{item.icon}<div className="min-w-0"><h2 className="font-semibold">{item.title}</h2><p className="mt-1 text-sm opacity-75">{item.detail}</p></div><Link href={item.href} className="btn btn-sm">{item.label}</Link></div>)}</div>}

    <section className="grid gap-4 xl:grid-cols-12">
      <div className="hover-3d xl:col-span-8">
        <div className="card h-full overflow-hidden bg-primary text-primary-content shadow-xl"><div className="card-body relative min-h-64 justify-between bg-[radial-gradient(circle_at_bottom_left,#ffffff0a_35%,transparent_36%),radial-gradient(circle_at_top_right,#ffffff0a_35%,transparent_36%)] bg-size-[5rem_5rem]">
          <div className="relative z-10"><p className="text-sm opacity-75">{cryptoOnlyValue ? "კრიპტოაქტივების ღირებულება" : "პორტფელის ღირებულება"}</p><p className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl"><BalanceValue>{money(displayedValue)}</BalanceValue></p><div className="mt-4 flex flex-wrap items-center gap-3"><span className="badge badge-lg border-0 bg-primary-content/15 text-primary-content"><BalanceValue>{s.totalPnl !== null && decimal(s.totalPnl).gt(0) ? "+" : ""}{money(s.totalPnl)}</BalanceValue></span><span className="text-sm opacity-75">მთლიანი შედეგი</span></div></div>
          <div className="relative z-10 text-sm opacity-70">{cryptoOnlyValue ? "ლიკვიდობის გარეშე" : "სრული პორტფელი"}</div><div className="pointer-events-none absolute -bottom-24 -right-16 size-72 rounded-full bg-secondary/30 blur-3xl" />
        </div></div>
        <div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div>
      </div>
      <div className="card border border-base-300 bg-base-200 xl:col-span-4"><div className="card-body"><h2 className="card-title text-base">სწრაფი მოქმედებები</h2><div className="grid grid-cols-2 gap-2"><QuickLink href={`${base}/positions`} icon={<Wallet size={20} />} label="პოზიციები" /><QuickLink href={`${base}/allocation`} icon={<PieChart size={20} />} label="განაწილება" /><QuickLink href={`${base}/transactions`} icon={<BarChart3 size={20} />} label="ისტორია" /><QuickLink href={`${base}/analytics`} icon={<TrendingUp size={20} />} label="ანალიტიკა" /></div></div></div>
    </section>

    <section className="grid gap-4 xl:grid-cols-12">
      <div className="card border border-base-300 bg-base-200 xl:col-span-8"><div className="card-body"><div className="flex items-start justify-between gap-4"><div><h2 className="card-title">პორტფელის ისტორია</h2><p className="mt-1 text-sm text-base-content/55">ღირებულება დროში</p></div><span className="badge badge-ghost">სრული პერიოდი</span></div><div className="mt-4 min-h-56">{history ?? <div className="grid min-h-56 place-items-center rounded-box border border-dashed border-base-300 text-sm text-base-content/50">ისტორიისთვის საჭიროა მინიმუმ ორი შეფასება</div>}</div></div></div>
      <div className="card border border-base-300 bg-base-200 xl:col-span-4"><div className="card-body"><h2 className="card-title">ლიკვიდობა</h2><p className="mt-2 text-3xl font-semibold"><BalanceValue>{money(s.liquidity)}</BalanceValue></p><p className="text-sm text-base-content/55">პორტფელის {percentage(liquidityShare?.toString() ?? null)}</p><progress className="progress progress-primary mt-3 w-full" value={liquidityShare ?? 0} max="100" /><div className="stats stats-vertical mt-4 border border-base-300 bg-base-100 sm:stats-horizontal xl:stats-vertical"><div className="stat py-4"><div className="stat-title">ნაღდი ფული</div><div className="stat-value text-xl"><BalanceValue>{money(s.cash)}</BalanceValue></div></div><div className="stat py-4"><div className="stat-title">სტეიბლკოინები</div><div className="stat-value text-xl"><BalanceValue>{money(s.stablecoinValue)}</BalanceValue></div></div></div></div></div>
    </section>

    <section className="stats stats-vertical w-full border border-base-300 bg-base-200 shadow-sm md:stats-horizontal"><OverviewStat icon={<Wallet size={18} />} label="წმინდა კაპიტალი" value={money(netCapital)} hint="შეტანები − გატანები" /><OverviewStat icon={<CircleDollarSign size={18} />} label="რეალიზებული P/L" value={money(s.realizedPnl)} hint="დახურული გარიგებები" tone={pnlClass(s.realizedPnl)} /><OverviewStat icon={<TrendingUp size={18} />} label="არარეალიზებული P/L" value={money(s.unrealizedPnl)} hint="აქტიური პოზიციები" tone={pnlClass(s.unrealizedPnl)} /><OverviewStat icon={<Activity size={18} />} label="აქტიური პოზიციები" value={String(positions.length)} hint="პორტფელში" /></section>

    <section className="grid gap-4 xl:grid-cols-12">
      <div className="card border border-base-300 bg-base-200 xl:col-span-5"><div className="card-body"><div className="flex items-center justify-between gap-3"><div><h2 className="card-title">კრიპტო განაწილება</h2><p className="mt-1 text-sm text-base-content/55">ლიკვიდობის გარეშე</p></div><Link href={`${base}/allocation`} className="btn btn-sm">მართვა</Link></div><div className="mt-5 flex h-3 overflow-hidden rounded-full bg-base-300">{crypto.map((position, index) => { const share = cryptoTotal.gt(0) ? Number(percent(position.value ?? "0", cryptoTotal.toString()) ?? 0) : 0; return <span key={position.assetId} className={palette[index % palette.length]} style={{ width: `${share}%` }} />; })}</div><ul className="list mt-4">{crypto.slice(0, 5).map((position, index) => <li key={position.assetId} className="list-row px-0"><AssetIcon symbol={position.asset.symbol} logoUrl={position.asset.logoUrl} index={index} /><div><div className="font-semibold">{position.asset.symbol}</div><div className="text-xs text-base-content/50">{position.asset.name}</div></div><div className="text-right"><div className="font-semibold">{percentage(position.allocation)}</div><div className="text-xs text-base-content/50"><BalanceValue>{money(position.value)}</BalanceValue></div></div></li>)}</ul></div></div>
      <div className="card border border-base-300 bg-base-200 xl:col-span-7"><div className="card-body"><div className="flex items-center justify-between gap-3"><h2 className="card-title">თქვენი აქტივები</h2><Link href={`${base}/positions`} className="btn btn-sm">ყველა პოზიცია</Link></div><ul className="list mt-2">{positions.slice(0, 6).map((position, index) => <li key={position.assetId} className="list-row px-0"><AssetIcon symbol={position.asset.symbol} logoUrl={position.asset.logoUrl} index={index} /><div><div className="font-semibold">{position.asset.symbol}</div><div className="text-xs text-base-content/50">{position.asset.name}</div></div><div className="text-right"><div className="font-semibold"><BalanceValue>{money(position.value)}</BalanceValue></div><div className={`text-xs ${pnlClass(position.returnPercent)}`}>{percentage(position.returnPercent, true)}</div></div><Link href={`${base}/positions/${position.assetId}`} className="btn btn-ghost btn-square btn-sm" aria-label={`${position.asset.symbol} დეტალები`}><ArrowUpRight size={16} /></Link></li>)}</ul></div></div>
    </section>
  </div>;
}

function QuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) { return <Link href={href} className="btn h-24 flex-col gap-2 bg-base-100"><span className="text-primary">{icon}</span><span>{label}</span></Link>; }

function OverviewStat({ icon, label, value, hint, tone = "" }: { icon: React.ReactNode; label: string; value: string; hint: string; tone?: string }) { return <div className="stat"><div className="stat-figure text-primary">{icon}</div><div className="stat-title">{label}</div><div className={`stat-value text-2xl ${tone}`}><BalanceValue>{value}</BalanceValue></div><div className="stat-desc">{hint}</div></div>; }

export function Metric({ label, value, hint, tone = "", sensitive = false }: { label: string; value: string; hint?: string; tone?: string; sensitive?: boolean }) { return <div className="stat min-w-0"><div className="stat-title" title={hint}>{label}</div><div className={`stat-value text-2xl ${tone}`}>{sensitive ? <BalanceValue>{value}</BalanceValue> : value}</div>{hint && <div className="stat-desc">{hint}</div>}</div>; }
