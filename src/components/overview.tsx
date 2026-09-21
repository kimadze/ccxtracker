import Link from "next/link";
import { ArrowUpRight, Wallet } from "lucide-react";
import type { PortfolioSummary } from "@/domain/types";
import { decimal, percent } from "@/domain/decimal";
import { dateTime, money, percentage, pnlClass } from "@/lib/formatters";
import { AssetIcon, PositionsTable } from "./positions";
import { PortfolioCalculator } from "./portfolio-calculator";

export function Overview({ summary: s, base, portfolioName, history, action }: {
  summary: PortfolioSummary;
  base: string;
  portfolioName: string;
  history?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const positions = [...s.positions].sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0));
  const crypto = positions.filter((p) => !p.asset.isStablecoin && Number(p.value ?? 0) > 0);
  const cryptoTotal = crypto.reduce((sum, p) => sum.plus(p.value ?? 0), decimal(0));
  const colors = ["var(--orange)", "var(--blue)", "var(--violet)", "var(--teal)", "var(--indigo)", "var(--grey)"];
  const slices = crypto.map((p, index) => ({
    position: p,
    label: p.asset.symbol,
    share: cryptoTotal.gt(0) ? percent(p.value ?? "0", cryptoTotal.toString()) : null,
    color: colors[index % colors.length],
  }));
  const allocationGradient = slices.reduce<{ end: number; stops: string[] }>((acc, slice, index) => {
    const end = index === slices.length - 1 ? 100 : acc.end + Number(slice.share ?? 0);
    return { end, stops: [...acc.stops, `${slice.color} ${acc.end}% ${end}%`] };
  }, { end: 0, stops: [] }).stops.join(", ");
  const primarySlices = slices.length > 5 ? slices.slice(0, 4) : slices;
  const remainingSlices = slices.length > 5 ? slices.slice(4) : [];
  const remainingValue = remainingSlices.reduce((sum, slice) => sum.plus(slice.position.value ?? 0), decimal(0));
  const remainingShare = remainingSlices.reduce((sum, slice) => sum + Number(slice.share ?? 0), 0);
  const netCapital = s.contributions !== null && s.withdrawals !== null
    ? decimal(s.contributions).minus(s.withdrawals).toString()
    : null;
  const largest = crypto[0];
  const freshness = positions.length === 0 ? "ფასის შეფასება ჯერ არ არის საჭირო"
    : s.stale ? "ფასების ნაწილი დაგვიანებულია"
    : s.complete ? "არსებული ფასები განახლებულია" : "ზოგი ფასი მიუწვდომელია";
  const quoteDates = positions.map((position) => position.quote?.updatedAt).filter((date): date is string => !!date);
  const updatedAt = quoteDates.length ? quoteDates.sort().at(-1) : undefined;

  return <div className="dashboard-space">
    <header className="dashboard-header">
      <div>
        <p className="eyebrow mb-1">{portfolioName}</p>
        <h1>პორტფელის მიმოხილვა</h1>
        <p className="mt-2 text-xs text-muted">{freshness}{updatedAt ? " · " + dateTime(updatedAt) : ""}</p>
      </div>
      {action}
    </header>
    {!s.complete && <p role="status" className="dashboard-alert">ზოგიერთი ფასი მიუწვდომელია — ნაჩვენებია მხოლოდ ცნობილი ღირებულება; მთლიანი შედეგი არ გამოითვლება.</p>}

    <section className="panel dashboard-chart-panel" aria-labelledby="portfolio-value-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="portfolio-value-title" className="text-sm font-semibold">პორტფელის ღირებულება</h2>
          <p className="dashboard-value numeric mt-3">{money(s.value ?? s.knownValue)}</p>
          <p className="mt-1 text-xs text-muted">{s.complete ? "მთლიანი შეფასება" : "ცნობილი ღირებულება · შეფასება არასრულია"}</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs text-muted">მთლიანი მოგება / ზარალი</p>
          <p className={`numeric mt-2 text-xl font-semibold ${pnlClass(s.totalPnl)}`}>{s.totalPnl !== null && decimal(s.totalPnl).gt(0) ? "+" : ""}{money(s.totalPnl)}</p>
          <p className="mt-1 text-xs text-muted">სრული პერიოდი · თანხის შეტანა/გატანის გარეშე</p>
        </div>
      </div>
      <div className="mt-5 border-t border-line pt-3">{history ?? <div className="dashboard-empty">ისტორიისთვის საჭიროა შენახული შეფასებები.</div>}</div>
    </section>

    <section className="panel dashboard-allocation" aria-labelledby="allocation-title">
      <div className="flex items-center justify-between gap-2 border-b border-line pb-4">
        <div><h2 id="allocation-title">კრიპტო აქტივების განაწილება</h2><p className="mt-1 text-xs text-muted">სტეიბლკოინებისა და ნაღდი ფულის გარეშე</p></div>
        <Link href={base + "/allocation"} className="button-secondary shrink-0">დეტალები <ArrowUpRight size={14} /></Link>
      </div>
      {!s.complete ? <div className="dashboard-empty">ყველა აქტივის ფასის მიღების შემდეგ განაწილება სრულად გამოჩნდება.</div>
        : !crypto.length ? <div className="dashboard-empty">არასტეიბლ კრიპტოაქტივები ჯერ არ გაქვთ.</div>
        : <div className="crypto-distribution">
          <div className="crypto-distribution-layout">
            <div className="crypto-distribution-chart">
              <div className="crypto-distribution-ring" style={{ background: `conic-gradient(${allocationGradient})` }}>
                <div><span>სულ</span><strong className="numeric">{money(cryptoTotal.toString(), true)}</strong><small>{crypto.length} აქტივი</small></div>
              </div>
              <div className="crypto-distribution-spectrum" aria-hidden="true">
                {slices.map((slice) => <span key={slice.position.assetId} style={{ flexGrow: Number(slice.share), background: slice.color }} />)}
              </div>
            </div>
            <div className="crypto-distribution-assets">
              <div className="crypto-distribution-labels"><span>აქტივი</span><span>წილი</span></div>
              <ul className="crypto-distribution-list">
                {primarySlices.map((slice, index) => <li key={slice.position.assetId}>
                  <Link href={`${base}/positions/${slice.position.assetId}`} className="crypto-distribution-asset">
                    <AssetIcon symbol={slice.label} logoUrl={slice.position.asset.logoUrl} index={index} />
                    <div className="crypto-distribution-identity"><strong>{slice.label}</strong><span className="numeric">{money(slice.position.value)}</span></div>
                    <strong className="crypto-distribution-share numeric">{percentage(slice.share)}</strong>
                    <ArrowUpRight size={13} className="crypto-distribution-arrow" />
                  </Link>
                </li>)}
                {remainingSlices.length > 0 && <li>
                  <div className="crypto-distribution-asset crypto-distribution-other">
                    <span className="crypto-distribution-other-icon">+{remainingSlices.length}</span>
                    <div className="crypto-distribution-identity"><strong>სხვა აქტივები</strong><span className="numeric">{money(remainingValue.toString())}</span></div>
                    <strong className="crypto-distribution-share numeric">{percentage(remainingShare.toString())}</strong>
                  </div>
                </li>}
              </ul>
            </div>
          </div>
          <p className="crypto-distribution-note">განაწილება მხოლოდ არასტეიბლ კრიპტოაქტივებს მოიცავს.</p>
        </div>}
    </section>

    <section className="dashboard-metrics" aria-label="პორტფელის მაჩვენებლები">
      <DashboardMetric label="წმინდა შეტანილი კაპიტალი" value={money(netCapital)} hint="შეტანები მინუს გატანები" />
      <DashboardMetric label="რეალიზებული P/L" value={money(s.realizedPnl)} tone={pnlClass(s.realizedPnl)} hint="დახურული გარიგებების შედეგი" />
      <DashboardMetric label="არარეალიზებული P/L" value={money(s.unrealizedPnl)} tone={pnlClass(s.unrealizedPnl)} hint="მიმდინარე პოზიციების შედეგი" />
      <DashboardMetric label="აქტიური პოზიციები" value={String(positions.length)} hint="მიმდინარე აქტივები" />
    </section>

    <section className="panel dashboard-positions" aria-labelledby="positions-title">
      <header><h2 id="positions-title">ჩემი აქტივები</h2><Link className="button-secondary" href={base + "/positions"}>ყველა პოზიცია <ArrowUpRight size={15} /></Link></header>
      <PositionsTable positions={s.positions} base={base} />
    </section>

    <aside className="dashboard-side-stack" aria-label="პორტფელის დამატებითი ინფორმაცია">
      <section className="panel">
        <div className="mb-4 flex items-center gap-2"><Wallet size={17} className="text-brand" /><h2>ლიკვიდობა</h2></div>
        <p className="numeric text-2xl font-semibold">{money(s.liquidity)}</p>
        <p className="mt-1 text-xs text-muted">პორტფელის {percentage(s.value && s.liquidity !== null ? percent(s.liquidity, s.value) : null)}</p>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-raised"><div className="h-full rounded-full bg-brand" style={{ width: Math.max(0, Math.min(100, Number(s.value && s.liquidity !== null ? percent(s.liquidity, s.value) : 0))) + "%" }} /></div>
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4 text-xs">
          <div><p className="text-muted">ნაღდი ფული</p><strong className="numeric mt-1 block text-sm">{money(s.cash)}</strong></div>
          <div><p className="text-muted">სტეიბლკოინები</p><strong className="numeric mt-1 block text-sm">{money(s.stablecoinValue)}</strong></div>
        </div>
      </section>
      <section className="panel">
        <h2>კონცენტრაცია</h2>
        <p className="mt-3 text-xs text-muted">უდიდესი არასტეიბლ პოზიცია</p>
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <strong className="text-lg">{largest?.asset.symbol ?? "—"}</strong>
          <strong className="numeric text-lg text-brand">{s.complete ? percentage(largest?.allocation ?? null) : "—"}</strong>
        </div>
        <p className="mt-2 text-xs text-muted">წილი მთელ პორტფელში</p>
      </section>
      <PortfolioCalculator positions={s.positions} />
    </aside>
  </div>;
}

function DashboardMetric({ label, value, hint, tone = "text-foreground" }: {
  label: string; value: string; hint: string; tone?: string;
}) {
  return <article className="panel dashboard-metric"><p>{label}</p><strong className={`numeric ${tone}`}>{value}</strong><small>{hint}</small></article>;
}

export function Metric({ label, value, hint, tone = "text-foreground" }: {
  label: string; value: string; hint?: string; tone?: string;
}) {
  return <div className="min-w-0 p-5"><p className="text-xs leading-5 text-muted" title={hint}>{label}</p><p className={`numeric mt-2 text-xl font-semibold ${tone}`}>{value}</p></div>;
}
