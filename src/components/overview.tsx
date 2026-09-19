import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Coins,
  RefreshCw,
  ShieldCheck,
  Target,
  Wallet,
} from "lucide-react";
import type { PortfolioSummary, ValuedPosition } from "@/domain/types";
import { money, percentage, pnlClass } from "@/lib/formatters";
import { percent } from "@/domain/decimal";
import { AssetIcon, PositionsTable } from "./positions";
import { PortfolioCalculator } from "./portfolio-calculator";
import styles from "./overview-reference.module.css";

const colors = [
  "#ff9e2d",
  "#377cff",
  "#895cf5",
  "#3ed9d0",
  "#6d79e5",
  "#8792bd",
];

export function Overview({
  summary,
  base,
  history,
  action,
}: {
  summary: PortfolioSummary;
  base: string;
  history?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const positions = [...summary.positions].sort(
    (a, b) => Number(b.allocation ?? 0) - Number(a.allocation ?? 0),
  );
  const listed = positions.filter(
    (position) =>
      !position.asset.isStablecoin && Number(position.value ?? 0) > 0,
  );
  const listedValue = listed.reduce(
    (total, position) => total + Number(position.value ?? 0),
    0,
  );
  const slices = listed.map((position, index) => ({
    logoUrl: position.asset.logoUrl,
    label: position.asset.symbol,
    share: listedValue ? (Number(position.value ?? 0) / listedValue) * 100 : 0,
    color: colors[index % colors.length],
  }));
  const gradient = slices
    .map((slice, index) => {
      const start = slices
        .slice(0, index)
        .reduce((total, item) => total + item.share, 0);
      return `${slice.color} ${start}% ${start + slice.share}%`;
    })
    .join(",");
  const pnlRate =
    summary.value && summary.totalPnl
      ? percent(summary.totalPnl, summary.value)
      : null;
  const liquidityShare =
    summary.value && summary.liquidity
      ? percent(summary.liquidity, summary.value)
      : null;
  const ranked = positions
    .filter((position) => position.unrealizedPnl !== null)
    .sort((a, b) => Number(b.unrealizedPnl) - Number(a.unrealizedPnl));
  const best = ranked[0],
    worst = ranked.at(-1),
    largest = listed[0];
  return (
    <div className={styles.root}>
      <header className={styles.heading}>
        <div>
          <h1>პორტფელის მიმოხილვა</h1>
          <p>თქვენი კრიპტო აქტივების სრული სურათი ერთ სივრცეში</p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-[#8997b2]">
          <span>
            {summary.stale ? "ზოგი ფასი მიუწვდომელია" : "ფასები განახლებულია"}
          </span>
          <Link className={styles.refresh} href={base}>
            <RefreshCw size={14} /> განახლება
          </Link>
        </div>
      </header>
      <section className={styles.workspace}>
        <div className={styles.left}>
          <section className={`${styles.card} ${styles.chart}`}>
            <header className={styles.chartHead}>
              <div>
                <p>პორტფელის მიმდინარე ღირებულება</p>
                <strong>{money(summary.value)}</strong>
                <span
                  className={`${styles.change} ${pnlClass(summary.totalPnl)}`}
                >
                  {summary.totalPnl && Number(summary.totalPnl) < 0 ? (
                    <ArrowDownRight size={16} />
                  ) : (
                    <ArrowUpRight size={16} />
                  )}{" "}
                  {money(summary.totalPnl)} ({percentage(pnlRate, true)})
                </span>
              </div>
              <small className={styles.chartNote}>ღირებულების ისტორია</small>
            </header>
            {history ?? (
              <div className={styles.chartEmpty}>
                ისტორიისთვის საჭიროა მინიმუმ ორი შენახული შეფასება.
              </div>
            )}
          </section>
          <section className={styles.metrics}>
            <DashboardMetric
              icon={<Coins />}
              label="აქტიური პოზიციები"
              value={String(positions.length)}
              hint="აქტიური კრიპტო აქტივი"
            />
            <DashboardMetric
              icon={<Wallet />}
              label="ნაღდი და სტეიბლები"
              value={money(summary.liquidity)}
              hint={percentage(liquidityShare)}
            />
            <DashboardMetric
              icon={<Target />}
              label="არარეალიზებული მოგება / ზარალი"
              value={money(summary.unrealizedPnl)}
              hint={percentage(pnlRate, true)}
              positive={Number(summary.unrealizedPnl ?? 0) >= 0}
            />
            <DashboardMetric
              icon={<CalendarDays />}
              label="სრული შეტანილი კაპიტალი"
              value={money(summary.contributions)}
              hint="პორტფელში შეტანილი თანხა"
            />
          </section>
          <section className={`${styles.card} ${styles.positions}`}>
            <header>
              <h2>ჩემი აქტივები</h2>
              <div>
                {action ?? (
                  <Link
                    className="button-primary"
                    href={`${base}/transactions`}
                  >
                    + ახალი აქტივი
                  </Link>
                )}
                <Link className={styles.allAssets} href={`${base}/positions`}>
                  ყველა აქტივი
                </Link>
              </div>
            </header>
            <PositionsTable positions={summary.positions} base={base} />
          </section>
        </div>
        <aside className={styles.right}>
          <section className={`${styles.card} ${styles.allocation}`}>
            <header className={styles.cardHeading}>
              <h2>პორტფელის განაწილება</h2>
              <Link href={`${base}/allocation`}>დეტალები ›</Link>
            </header>
            <div className={styles.allocationBody}>
              <div
                className={styles.donut}
                style={{
                  background: gradient
                    ? `conic-gradient(${gradient})`
                    : "#202b42",
                }}
              >
                <div className={styles.donutInner}>
                  <strong>{money(String(listedValue), true)}</strong>
                  <span>სულ</span>
                </div>
              </div>
              <div className={styles.legend}>
                {slices.slice(0, 5).map((slice) => (
                  <div key={slice.label}>
                    <AssetIcon symbol={slice.label} logoUrl={slice.logoUrl} />
                    <span>{slice.label}</span>
                    <b>{percentage(String(slice.share))}</b>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <section className={`${styles.card} ${styles.concentration}`}>
            <header>
              <h2>კონცენტრაციის მონიტორინგი</h2>
              <ShieldCheck size={16} />
            </header>
            <div className={styles.progress}>
              <i
                style={{
                  width: `${Math.min(Number(largest?.allocation ?? 0), 100)}%`,
                }}
              />
            </div>
            <strong>
              {largest
                ? `${largest.asset.symbol} — ${percentage(largest.allocation)}`
                : "მონაცემი ჯერ არ არის"}
            </strong>
            <p>
              {largest
                ? "პორტფელის უდიდესი არასტეიბლ პოზიცია"
                : "დაამატეთ აქტივი განაწილების სანახავად"}
            </p>
          </section>
          <section className={`${styles.card} ${styles.performers}`}>
            <header>
              <h2>საუკეთესო და უარესი შედეგი</h2>
            </header>
            <div className={styles.performerGrid}>
              <Performer label="საუკეთესო შედეგი" position={best} tone="best" />
              <Performer label="უარესი შედეგი" position={worst} tone="worst" />
            </div>
          </section>
          {positions.length > 0 && (
            <details className={`${styles.card} ${styles.calculator}`}>
              <summary>პოტენციური P/L — კალკულატორი</summary>
              <PortfolioCalculator positions={summary.positions} />
            </details>
          )}
        </aside>
      </section>
    </div>
  );
}
function DashboardMetric({
  icon,
  label,
  value,
  hint,
  positive,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  positive?: boolean;
}) {
  return (
    <article className={`${styles.card} ${styles.metric}`}>
      <span
        className={`${styles.metricIcon} ${positive ? styles.positive : ""}`}
      >
        {icon}
      </span>
      <div className={styles.metricText}>
        <p>{label}</p>
        <strong>{value}</strong>
        <small className={positive ? styles.positive : ""}>{hint}</small>
      </div>
    </article>
  );
}
function Performer({
  label,
  position,
  tone,
}: {
  label: string;
  position?: ValuedPosition;
  tone: "best" | "worst";
}) {
  const className =
    tone === "best" ? styles.performerBest : styles.performerWorst;
  if (!position)
    return (
      <article className={`${styles.performer} ${className}`}>
        <small>{label}</small>
        <strong>—</strong>
      </article>
    );
  return (
    <article className={`${styles.performer} ${className}`}>
      <small>{label}</small>
      <strong className={styles.performerAsset}>
        <AssetIcon
          symbol={position.asset.symbol}
          logoUrl={position.asset.logoUrl}
        />
        {position.asset.symbol}
      </strong>
      <span className={pnlClass(position.unrealizedPnl)}>
        {tone === "best" ? (
          <ArrowUpRight size={14} />
        ) : (
          <ArrowDownRight size={14} />
        )}{" "}
        {money(position.unrealizedPnl)}
      </span>
    </article>
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
