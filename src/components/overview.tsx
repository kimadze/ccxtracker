import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, CalendarDays, Coins, RefreshCw, ShieldCheck, Target, Wallet } from "lucide-react";
import type { PortfolioSummary } from "@/domain/types";
import { money, percentage, pnlClass } from "@/lib/formatters";
import { percent } from "@/domain/decimal";
import { PositionsTable } from "./positions";
import { PortfolioCalculator } from "./portfolio-calculator";

export function Overview({ summary: s, base, history, action }: { summary: PortfolioSummary; base: string; history?: React.ReactNode; action?: React.ReactNode }) {
  const positions = [...s.positions].sort((a, b) => Number(b.allocation ?? 0) - Number(a.allocation ?? 0));
  const allocationPositions = positions.filter((position) => !position.asset.isStablecoin && Number(position.value ?? 0) > 0);
  const allocationValue = allocationPositions.reduce((total, position) => total + Number(position.value ?? 0), 0);
  const liquidityShare = s.value && s.liquidity !== null ? percent(s.liquidity, s.value) : null;
  const pnlRate = s.value && s.totalPnl ? percent(s.totalPnl, s.value) : null;
  const colors = ["var(--orange)", "var(--blue)", "var(--violet)", "var(--teal)", "var(--indigo)", "var(--grey)"];
  const slices = allocationPositions.map((position, index) => ({ label: position.asset.symbol, value: allocationValue ? Number(position.value ?? 0) / allocationValue * 100 : 0, color: colors[index % colors.length] }));
  const gradient = slices.map((slice, index) => { const start = slices.slice(0, index).reduce((total, item) => total + item.value, 0); return `${slice.color} ${start}% ${start + slice.value}%`; }).join(",");
  const ranked = positions.filter((position) => position.unrealizedPnl !== null).sort((a, b) => Number(b.unrealizedPnl) - Number(a.unrealizedPnl));
  const best = ranked[0], worst = ranked.at(-1);
  const largest = allocationPositions[0];
  return <div className="reference-dashboard">
    <header className="reference-page-heading"><div><h1>პორტფელის მიმოხილვა</h1><p>თქვენი კრიპტო აქტივების სრული სურათი ერთ სივრცეში</p></div><div><span>{s.stale ? "ზოგი ფასი მიუწვდომელია" : "ფასები განახლებულია"}</span><Link className="reference-refresh" href={base}><RefreshCw size={14}/> განახლება</Link></div></header>
    <div className="reference-dashboard__grid">
      <section className="panel reference-value-chart"><header><div><p>პორტფელის მიმდინარე ღირებულება</p><strong>{money(s.value)}</strong><span className={pnlClass(s.totalPnl)}>{money(s.totalPnl)} ({percentage(pnlRate, true)}) <ArrowUpRight size={15}/></span></div><small>ბოლო 1 თვის ცვლილება</small></header>{history ?? <div className="reference-chart-empty">ისტორიისთვის საჭიროა მინიმუმ ორი შენახული შეფასება.</div>}</section>
      <aside className="panel reference-allocation"><header><h2>პორტფელის განაწილება</h2><Link href={`${base}/allocation`}>დეტალები ›</Link></header><div className="reference-allocation__body"><div className="reference-donut" style={{ background: gradient ? `conic-gradient(${gradient})` : "var(--surface-raised)" }}><div><strong>{money(String(allocationValue), true)}</strong><span>სულ</span></div></div><div className="reference-allocation__legend">{slices.slice(0, 5).map((slice) => <div key={slice.label}><i style={{ background: slice.color }}/><span>{slice.label}</span><b>{percentage(String(slice.value))}</b></div>)}</div></div></aside>
    </div>
    <section className="reference-metric-row"><ReferenceMetric icon={<Coins/>} label="აქტიური პოზიციები" value={String(s.positions.length)} hint="აქტიური კრიპტო აქტივი"/><ReferenceMetric icon={<Wallet/>} label="ნაღდი და სტეიბლები" value={money(s.liquidity)} hint={percentage(liquidityShare)}/><ReferenceMetric icon={<Target/>} label="არარეალიზებული მოგება / ზარალი" value={money(s.unrealizedPnl)} hint={percentage(pnlRate, true)} positive={Number(s.unrealizedPnl ?? 0) >= 0}/><ReferenceMetric icon={<CalendarDays/>} label="მთლიანი შეტანილი კაპიტალი" value={money(s.contributions)} hint="სრული შეტანილი თანხა"/></section>
    <div className="reference-dashboard__lower"><section className="panel reference-positions"><header><h2>ჩემი აქტივები</h2><div>{action ?? <Link className="reference-add" href={`${base}/transactions`}>+ ახალი აქტივი</Link>}<Link className="reference-all-assets" href={`${base}/positions`}>ყველა აქტივი</Link></div></header><PositionsTable positions={s.positions} base={base}/></section><aside className="reference-insights"><section className="panel reference-concentration"><header><h2>კონცენტრაციის მონიტორინგი</h2><ShieldCheck size={16}/></header><div className="reference-progress"><span style={{ width: `${Math.min(Number(largest?.allocation ?? 0), 100)}%` }}/></div><strong>{largest ? `${largest.asset.symbol} — ${percentage(largest.allocation)}` : "მონაცემი ჯერ არ არის"}</strong><p>{largest ? "პორტფელის უდიდესი არასტეიბლ პოზიცია" : "დაამატეთ აქტივი განაწილების სანახავად"}</p></section><section className="panel reference-performers"><header><h2>საუკეთესო და უარესი შედეგი</h2></header><div>{best ? <Performer label="საუკეთესო შედეგი" position={best} positive/> : <EmptyPerformer/>}{worst && worst.assetId !== best?.assetId ? <Performer label="უარესი შედეგი" position={worst}/> : <EmptyPerformer/>}</div></section><section className="reference-calculator-wrap"><PortfolioCalculator positions={s.positions}/></section></aside></div>
  </div>;
}
function ReferenceMetric({ icon, label, value, hint, positive }: { icon: React.ReactNode; label: string; value: string; hint: string; positive?: boolean }) { return <article className="panel reference-metric"><span className={positive === false ? "is-negative" : positive ? "is-positive" : ""}>{icon}</span><div><p>{label}</p><strong>{value}</strong><small className={positive === undefined ? "" : positive ? "text-positive" : "text-negative"}>{hint}</small></div></article>; }
function Performer({ label, position, positive = false }: { label: string; position: PortfolioSummary["positions"][number]; positive?: boolean }) { return <article className={positive ? "is-best" : "is-worst"}><div><small>{label}</small><strong>{position.asset.symbol}</strong></div><span className={pnlClass(position.unrealizedPnl)}>{positive ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>} {money(position.unrealizedPnl)}</span></article>; }
function EmptyPerformer() { return <article className="is-empty"><small>მონაცემი არ არის</small><strong>—</strong></article>; }
export function Metric({ label, value, hint, tone = "text-foreground" }: { label: string; value: string; hint?: string; tone?: string }) { return <div className="min-w-0 p-5 sm:p-6"><p className="max-w-48 text-[11px] leading-5 text-muted" title={hint}>{label}</p><p className={`numeric mt-2 text-xl font-medium sm:text-2xl ${tone}`}>{value}</p></div>; }
