import {
  AlertTriangle,
  CircleCheck,
  Droplets,
  Landmark,
  PieChart,
  TrendingUp,
} from "lucide-react";
import { amount, decimal, percent } from "@/domain/decimal";
import type { PortfolioSummary } from "@/domain/types";
import { money, percentage, pnlClass } from "@/lib/formatters";
import styles from "./dashboard-hero.module.css";

export function DashboardHero({ summary }: { summary: PortfolioSummary }) {
  const contributions = decimal(summary.contributions ?? "0");
  const withdrawals = decimal(summary.withdrawals ?? "0");
  const netCapital = amount(contributions.minus(withdrawals));
  const returnPercent = decimal(netCapital).gt(0)
    ? percent(summary.totalPnl ?? "0", netCapital)
    : null;
  const liquidityPercent =
    summary.value && summary.liquidity !== null
      ? percent(summary.liquidity, summary.value)
      : null;
  const cryptoPositions = summary.positions.filter(
    (position) =>
      !position.asset.isStablecoin && Number(position.value ?? 0) > 0,
  );
  const cryptoValue = cryptoPositions.reduce(
    (total, position) => total.plus(position.value ?? "0"),
    decimal("0"),
  );
  const largest = [...cryptoPositions].sort((a, b) =>
    decimal(b.value ?? "0").cmp(a.value ?? "0"),
  )[0];
  const concentration =
    largest && !cryptoValue.isZero()
      ? percent(largest.value ?? "0", cryptoValue)
      : null;
  const capitalBar = contributions.lte(0)
    ? 0
    : Math.max(
        0,
        Math.min(100, (Number(netCapital) / Number(contributions)) * 100),
      );
  const pnlBar =
    returnPercent === null ? 0 : Math.min(100, Math.abs(Number(returnPercent)));
  const liquidityBar =
    liquidityPercent === null
      ? 0
      : Math.min(100, Math.max(0, Number(liquidityPercent)));
  const concentrationBar =
    concentration === null
      ? 0
      : Math.min(100, Math.max(0, Number(concentration)));
  const status =
    summary.complete && !summary.stale
      ? {
          label: "ფასები განახლებულია",
          icon: <CircleCheck size={14} />,
          tone: "healthy",
        }
      : {
          label: summary.stale
            ? "ფასები დაყოვნებულია"
            : "ზოგი ფასი მიუწვდომელია",
          icon: <AlertTriangle size={14} />,
          tone: "attention",
        };

  return (
    <section className={styles.hero} aria-labelledby="portfolio-health-title">
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Live portfolio</p>
        <h1 id="portfolio-health-title">პორტფელის მდგომარეობა</h1>
        <p className={`${styles.status} ${styles[status.tone]}`}>
          {status.icon}
          {status.label}
        </p>
      </div>
      <div className={styles.stats}>
        <HeroStat
          icon={<Landmark size={17} />}
          label="წმინდა კაპიტალი"
          value={money(netCapital)}
          detail={`შეტანილი ${money(summary.contributions)} · გატანილი ${money(summary.withdrawals)}`}
          progress={capitalBar}
          tone="violet"
        />
        <HeroStat
          icon={<TrendingUp size={17} />}
          label="მთლიანი P/L"
          value={money(summary.totalPnl)}
          detail={percentage(returnPercent, true)}
          progress={pnlBar}
          tone={
            summary.totalPnl !== null && decimal(summary.totalPnl).lt(0)
              ? "negative"
              : "positive"
          }
          valueClass={pnlClass(summary.totalPnl)}
        />
        <HeroStat
          icon={<Droplets size={17} />}
          label="ლიკვიდობა"
          value={money(summary.liquidity)}
          detail={`პორტფელის ${percentage(liquidityPercent)}`}
          progress={liquidityBar}
          tone="blue"
        />
        <HeroStat
          icon={<PieChart size={17} />}
          label="კონცენტრაცია"
          value={largest?.asset.symbol ?? "—"}
          detail={
            largest
              ? `კრიპტო აქტივების ${percentage(concentration)}`
              : "აქტიური კრიპტო პოზიცია არ არის"
          }
          progress={concentrationBar}
          tone="violet"
          count={summary.positions.length}
        />
      </div>
    </section>
  );
}

function HeroStat({
  icon,
  label,
  value,
  detail,
  progress,
  tone,
  valueClass,
  count,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  progress: number;
  tone: "violet" | "positive" | "negative" | "blue";
  valueClass?: string;
  count?: number;
}) {
  return (
    <article className={styles.stat}>
      <div className={styles.statLabel}>
        <i className={`${styles.icon} ${styles[tone]}`}>{icon}</i>
        <span>{label}</span>
        {count !== undefined && <b>{count} პოზიცია</b>}
      </div>
      <strong className={`${styles.value} ${valueClass ?? ""}`}>{value}</strong>
      <p>{detail}</p>
      <div className={styles.track}>
        <span
          className={`${styles.fill} ${styles[tone]}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </article>
  );
}
