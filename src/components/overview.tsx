import Link from "next/link";
import Image from "next/image";
import { ArrowLeftRight, CalendarDays, Coins, Pencil, Plus, Target, Wallet } from "lucide-react";
import type { PortfolioSummary } from "@/domain/types";
import { money, percentage, pnlClass } from "@/lib/formatters";
import { percent } from "@/domain/decimal";
import { PositionsTable } from "./positions";
import { PortfolioCalculator } from "./portfolio-calculator";

export function Overview({ summary: s, base, preview = false, history, action }: {
  summary: PortfolioSummary;
  base: string;
  preview?: boolean;
  history?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const positions = [...s.positions].sort((a, b) => Number(b.allocation ?? 0) - Number(a.allocation ?? 0));
  const liquidityShare = s.value && s.liquidity !== null ? percent(s.liquidity, s.value) : null;
  const colors = ["var(--orange)", "var(--blue)", "var(--violet)", "var(--teal)", "var(--indigo)", "var(--grey)"];
  const allocationPositions = positions.filter((position) => !position.asset.isStablecoin && Number(position.value ?? 0) > 0);
  const allocationValue = allocationPositions.reduce((total, position) => total + Number(position.value ?? 0), 0);
  const slices = allocationPositions.map((position, index) => ({
    label: position.asset.symbol,
    value: allocationValue ? (Number(position.value ?? 0) / allocationValue) * 100 : 0,
    color: colors[index % colors.length],
  }));
  const gradient = slices.map((slice, index) => {
    const start = slices.slice(0, index).reduce((total, item) => total + item.value, 0);
    return `${slice.color} ${start}% ${start + slice.value}%`;
  }).join(",");

  return <div className="dashboard-space">
    {!s.complete && <div role="status" className="dashboard-alert">ზოგიერთი ფასი მიუწვდომელია — ნაჩვენებია ცნობილი ღირებულება.</div>}
    <section className="dashboard-hero">
      <div className="dashboard-hero-copy">
        <h1>Track. <span>Analyze.</span> <strong>Grow.</strong></h1>
        <p>Your simple crypto portfolio tracker</p>
      </div>
      <Image src="/ccx-mountain-hero.png" alt="" aria-hidden="true" width={900} height={300} priority />
      <div className="dashboard-hero-motto"><span>One Portfolio</span><br/>A Bigger Tomorrow</div>
      <div className="dashboard-hero-brand" aria-hidden="true">X</div>
    </section>

    <section className="dashboard-metrics">
      <DashboardMetric icon={<Wallet size={20}/>} label="სრული პორტფელი" value={money(s.value)} change={`${money(s.totalPnl)}  ${percentage(s.value && s.totalPnl ? percent(s.totalPnl, s.value) : null, true)}`} />
      <DashboardMetric icon={<CalendarDays size={20}/>} label="ლიკვიდობის რეზერვი" value={money(s.liquidity)} change={percentage(liquidityShare)} />
      <DashboardMetric icon={<Target size={20}/>} label="რეალიზებული P/L" value={money(s.realizedPnl)} change="დახურული პოზიციები" />
      <DashboardMetric icon={<Coins size={20}/>} label="აქტიური მონეტები" value={String(s.positions.length).padStart(2, "0")} change={`${positions.length} შეფასებული აქტივი`} />
    </section>

    <section className="dashboard-middle">
      <section className="panel dashboard-chart-panel">
        <header><div><h2>პორტფელის ღირებულება</h2><p>ღირებულების ცვლილება დროში</p></div><div className={pnlClass(s.totalPnl)}><strong>{percentage(s.value && s.totalPnl ? percent(s.totalPnl, s.value) : null, true)}</strong><span>{money(s.totalPnl)}</span></div></header>
        {history ?? <div className="dashboard-empty">ისტორიისთვის საჭიროა შენახული შეფასებები.</div>}
      </section>
      <section className="panel dashboard-allocation">
        <header><h2>კრიპტო აქტივების განაწილება</h2><Link href={`${base}/allocation`}>ნახვა</Link></header>
        <div className="allocation-body">
          <div className="allocation-donut" style={{ background: gradient ? `conic-gradient(${gradient})` : "var(--surface-raised)" }}><div><strong>{money(String(allocationValue), true)}</strong><span>კრიპტო აქტივები</span></div></div>
          <div className="allocation-legend">{slices.slice(0, 6).map((slice) => <div key={slice.label}><i style={{background:slice.color}}/><span>{slice.label}</span><strong>{percentage(String(slice.value))}</strong></div>)}</div>
        </div>
      </section>
    </section>

    <section className="dashboard-lower">
      <section className="panel dashboard-positions">
        <header><h2>ჩემი აქტივები</h2><div>{action ?? <Link className="button-primary" href={preview ? "/login" : `${base}/transactions`}><Plus size={15}/> ახალი აქტივი</Link>}</div></header>
        <PositionsTable positions={s.positions} base={base} preview={preview}/>
      </section>
      <aside className="dashboard-side-stack">
        <PortfolioCalculator positions={s.positions}/>
        <section className="panel dashboard-actions p-4"><h2>სწრაფი ქმედებები</h2><div><Link href={`${base}/transactions`}><Plus size={16}/> ახალი აქტივი</Link><Link href={`${base}/positions`}><Pencil size={16}/> აქტივის რედაქტირება</Link><Link href={`${base}/transactions`}><ArrowLeftRight size={16}/> ტრანზაქცია</Link><Link href={`${base}/settings`} className="danger">პარამეტრები</Link></div></section>
      </aside>
    </section>

    <footer className="live-ticker"><span>Live Prices:</span>{positions.slice(0,5).map((position) => <div key={position.assetId}><strong>{position.asset.symbol}</strong><span>{money(position.quote?.price ?? null)}</span><i className={pnlClass(position.quote?.change24h ?? null)}>{percentage(position.quote?.change24h ?? null, true)}</i></div>)}<small><b/>Market data: {s.stale ? "Delayed" : "Live"}</small></footer>
  </div>;
}

function DashboardMetric({ icon, label, value, change }: { icon: React.ReactNode; label: string; value: string; change: string }) {
  return <article className="panel dashboard-metric"><span>{icon}</span><div><p>{label}</p><strong className="numeric">{value}</strong><small>{change}</small></div></article>;
}

export function Metric({ label, value, hint, tone = "text-foreground" }: { label: string; value: string; hint?: string; tone?: string }) {
  return <div className="min-w-0 p-5 sm:p-6"><p className="max-w-48 text-[11px] leading-5 text-muted" title={hint}>{label}</p><p className={`numeric mt-2 text-xl font-medium sm:text-2xl ${tone}`}>{value}</p></div>;
}
