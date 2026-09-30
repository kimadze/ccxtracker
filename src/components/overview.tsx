import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  ChevronRight,
  CircleDollarSign,
  PieChart,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { PortfolioSummary } from "@/domain/types";
import { decimal, percent } from "@/domain/decimal";
import { dateTime, money, percentage, pnlClass } from "@/lib/formatters";
import { AssetIcon, PositionsTable } from "./positions";
import { BalanceValue } from "./ui";

export function Overview({
  summary: s,
  base,
  portfolioName,
  cryptoOnlyValue = false,
  history,
  action,
}: {
  summary: PortfolioSummary;
  base: string;
  portfolioName: string;
  cryptoOnlyValue?: boolean;
  history?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const positions = [...s.positions].sort(
    (a, b) => Number(b.value ?? 0) - Number(a.value ?? 0),
  );
  const crypto = positions.filter(
    (p) => !p.asset.isStablecoin && Number(p.value ?? 0) > 0,
  );
  const cryptoTotal = crypto.reduce(
    (sum, p) => sum.plus(p.value ?? 0),
    decimal(0),
  );
  const displayedValue = cryptoOnlyValue
    ? cryptoTotal.toString()
    : (s.value ?? s.knownValue);
  const colors = [
    "var(--orange)",
    "var(--blue)",
    "var(--violet)",
    "var(--teal)",
    "var(--indigo)",
    "var(--grey)",
  ];
  const slices = crypto.map((p, index) => ({
    position: p,
    label: p.asset.symbol,
    share: cryptoTotal.gt(0)
      ? percent(p.value ?? "0", cryptoTotal.toString())
      : null,
    color: colors[index % colors.length],
  }));
  const allocationGradient = slices
    .reduce<{ end: number; stops: string[] }>(
      (acc, slice, index) => {
        const end =
          index === slices.length - 1
            ? 100
            : acc.end + Number(slice.share ?? 0);
        return {
          end,
          stops: [...acc.stops, `${slice.color} ${acc.end}% ${end}%`],
        };
      },
      { end: 0, stops: [] },
    )
    .stops.join(", ");
  const primarySlices = slices.length > 5 ? slices.slice(0, 4) : slices;
  const remainingSlices = slices.length > 5 ? slices.slice(4) : [];
  const remainingValue = remainingSlices.reduce(
    (sum, slice) => sum.plus(slice.position.value ?? 0),
    decimal(0),
  );
  const remainingShare = remainingSlices.reduce(
    (sum, slice) => sum + Number(slice.share ?? 0),
    0,
  );
  const netCapital =
    s.contributions !== null && s.withdrawals !== null
      ? decimal(s.contributions).minus(s.withdrawals).toString()
      : null;
  const largest = crypto[0];
  const freshness =
    positions.length === 0
      ? "ფასის შეფასება ჯერ არ არის საჭირო"
      : s.stale
        ? "ფასების ნაწილი დაგვიანებულია"
        : s.complete
          ? "არსებული ფასები განახლებულია"
          : "ზოგი ფასი მიუწვდომელია";
  const quoteDates = positions
    .map((position) => position.quote?.updatedAt)
    .filter((date): date is string => !!date);
  const updatedAt = quoteDates.length ? quoteDates.sort().at(-1) : undefined;
  const liquidityShare =
    s.value && s.liquidity !== null
      ? Number(percent(s.liquidity, s.value) ?? 0)
      : null;
  const nextActions = [
    !s.complete
      ? {
          tone: "warning",
          icon: <AlertTriangle size={15} />,
          title: "ფასის მონაცემები არასრულია",
          detail: "შეამოწმეთ აქტივები, რომელთაც მიმდინარე ფასი არ აქვთ.",
          href: `${base}/positions`,
          action: "პოზიციების ნახვა",
        }
      : null,
    s.complete && largest && Number(largest.allocation ?? 0) >= 35
      ? {
          tone: "brand",
          icon: <PieChart size={15} />,
          title: `${largest.asset.symbol} პორტფელის ${percentage(largest.allocation)}-ს შეადგენს`,
          detail: "შეადარეთ ეს წილი თქვენს მიზნობრივ განაწილებას.",
          href: `${base}/allocation`,
          action: "განაწილების ნახვა",
        }
      : null,
    liquidityShare !== null && liquidityShare < 10
      ? {
          tone: "warning",
          icon: <Wallet size={15} />,
          title: "ლიკვიდობის წილი დაბალია",
          detail: `ქეში და სტეიბლკოინები პორტფელის ${percentage(String(liquidityShare))}-ს შეადგენს.`,
          href: `${base}/positions`,
          action: "პოზიციების მართვა",
        }
      : null,
    s.complete &&
    largest &&
    Number(largest.allocation ?? 0) < 35 &&
    (liquidityShare === null || liquidityShare >= 10)
      ? {
          tone: "ready",
          icon: <TrendingUp size={15} />,
          title: "პორტფელის ძირითადი მონაცემები სრულია",
          detail: "შეამოწმეთ სტრატეგია ან შექმენით ფასის სცენარი.",
          href: `${base}/scenarios`,
          action: "სცენარების გახსნა",
        }
      : null,
  ]
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .slice(0, 3);

  return (
    <>
      <div className="mobile-overview-app">
        <section className="mobile-health-card">
          <div className="mobile-health-heading">
            <h1 className="eyebrow" aria-label="პორტფელის მდგომარეობა">
              პორტფელის ღირებულება
            </h1>
            <p className="mobile-health-status">
              <span
                className={
                  s.complete && !s.stale
                    ? "mobile-status-dot ready"
                    : "mobile-status-dot warning"
                }
              />
              {freshness}
            </p>
          </div>
          <p className="mobile-health-value numeric">
            <BalanceValue>{money(displayedValue)}</BalanceValue>
          </p>
          <div className="mobile-health-pnl">
            <strong className={pnlClass(s.totalPnl)}>
              <BalanceValue>
                {s.totalPnl !== null && decimal(s.totalPnl).gt(0) ? "+" : ""}
                {money(s.totalPnl)}
              </BalanceValue>
            </strong>
            <span>მთლიანი შედეგი</span>
          </div>
        </section>
        <div className="mobile-quick-actions">
          {action}
          <Link href={base + "/positions"} className="button-secondary">
            პოზიციები <ArrowUpRight size={15} />
          </Link>
        </div>
        <section className="mobile-liquidity-strip" aria-label="ლიკვიდობა">
          <div>
            <span>
              <Wallet size={15} /> ნაღდი ფული
            </span>
            <strong className="numeric">
              <BalanceValue>{money(s.cash)}</BalanceValue>
            </strong>
          </div>
          <i aria-hidden="true" />
          <div>
            <span>
              <CircleDollarSign size={15} /> სტეიბლკოინები
            </span>
            <strong className="numeric">
              <BalanceValue>{money(s.stablecoinValue)}</BalanceValue>
            </strong>
          </div>
        </section>
        <details className="mobile-history-disclosure">
          <summary>
            <span className="mobile-history-icon">
              <BarChart3 size={19} />
            </span>
            <span>
              <strong>პორტფელის ისტორია</strong>
              <small>
                {updatedAt
                  ? `ბოლო შეფასება · ${dateTime(updatedAt, true)}`
                  : "შეფასებები ავტომატურად ინახება"}
              </small>
            </span>
            <ChevronRight size={18} />
          </summary>
          <div className="mobile-chart-slot">
            {history ?? <span>ისტორიისთვის საჭიროა მინიმუმ ორი შეფასება.</span>}
          </div>
        </details>
        <section className="mobile-allocation-compact">
          <div className="mobile-section-heading">
            <h2>კრიპტო განაწილება</h2>
            <strong className="numeric">
              <BalanceValue>{money(cryptoTotal.toString())}</BalanceValue>
            </strong>
          </div>
          <div className="mobile-allocation-strip">
            {slices.map((slice) => (
              <span
                key={slice.position.assetId}
                title={`${slice.label} ${percentage(slice.share)}`}
                style={{
                  flexGrow: Number(slice.share ?? 0),
                  background: slice.color,
                }}
              />
            ))}
          </div>
          <p>მხოლოდ კრიპტოაქტივები · ლიკვიდობის გარეშე</p>
        </section>
        <section className="mobile-assets-section">
          <div className="mobile-section-heading">
            <h2>თქვენი აქტივები</h2>
            <Link href={base + "/positions"}>
              ყველა <ArrowUpRight size={13} />
            </Link>
          </div>
          <div className="mobile-position-list">
            {positions.slice(0, 5).map((position, index) => (
              <Link
                key={position.assetId}
                href={`${base}/positions/${position.assetId}`}
              >
                <AssetIcon
                  symbol={position.asset.symbol}
                  logoUrl={position.asset.logoUrl}
                  index={index}
                />
                <div>
                  <strong>{position.asset.symbol}</strong>
                  <span>{position.asset.name}</span>
                </div>
                <div className="mobile-position-value">
                  <strong className="numeric">
                    <BalanceValue>{money(position.value)}</BalanceValue>
                  </strong>
                  <span className={pnlClass(position.returnPercent)}>
                    {percentage(position.returnPercent, true)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
      <div className="dashboard-space">
        <header className="dashboard-header overview-page-header">
          <div>
            <p className="eyebrow mb-1">პორტფელი / {portfolioName}</p>
            <h1>პორტფელის მიმოხილვა</h1>
            <p className="mt-2 text-xs text-muted">
              <span
                className={
                  s.complete ? "overview-freshness ready" : "overview-freshness"
                }
              />
              {freshness}
              {updatedAt ? " · " + dateTime(updatedAt) : ""}
            </p>
          </div>
          <div className="dashboard-actions">
            {action}
            <Link href={base + "/positions"} className="button-secondary">
              პოზიციების მართვა <ArrowUpRight size={15} />
            </Link>
          </div>
        </header>
        {!s.complete && (
          <p role="status" className="dashboard-alert">
            ზოგიერთი ფასი მიუწვდომელია — ნაჩვენებია მხოლოდ ცნობილი ღირებულება;
            მთლიანი შედეგი არ გამოითვლება.
          </p>
        )}
        <OverviewNextActions items={nextActions} />

        <section
          className="dashboard-chart-panel overview-performance"
          aria-labelledby="portfolio-value-title"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="overview-section-kicker">Portfolio Performance</p>
              <h2 id="portfolio-value-title" className="text-sm font-semibold">
                {cryptoOnlyValue
                  ? "კრიპტოაქტივების ღირებულება"
                  : "პორტფელის ღირებულება"}
              </h2>
              <p className="dashboard-value numeric mt-3">
                <BalanceValue>{money(displayedValue)}</BalanceValue>
              </p>
              <p className="mt-1 text-xs text-muted">
                {cryptoOnlyValue
                  ? `ნაღდი ფულისა და სტეიბლკოინების გარეშე${s.complete ? "" : " · შეფასება არასრულია"}`
                  : s.complete
                    ? "მთლიანი შეფასება"
                    : "ცნობილი ღირებულება · შეფასება არასრულია"}
              </p>
            </div>
            <div className="overview-performance-pnl text-left sm:text-right">
              <p className="text-xs text-muted">მთლიანი მოგება / ზარალი</p>
              <p
                className={`numeric mt-2 text-xl font-semibold ${pnlClass(s.totalPnl)}`}
              >
                <BalanceValue>
                  {s.totalPnl !== null && decimal(s.totalPnl).gt(0) ? "+" : ""}
                  {money(s.totalPnl)}
                </BalanceValue>
              </p>
              <p className="mt-1 text-xs text-muted">
                სრული პერიოდი · თანხის შეტანა/გატანის გარეშე
              </p>
            </div>
          </div>
          <div className="mt-5 border-t border-line pt-3">
            {cryptoOnlyValue && (
              <p className="mb-2 text-[11px] text-muted">
                ისტორიის გრაფიკი სრული პორტფელის შენახულ შეფასებებს აჩვენებს.
              </p>
            )}
            {history ?? (
              <div className="dashboard-empty">
                ისტორიისთვის საჭიროა შენახული შეფასებები.
              </div>
            )}
          </div>
        </section>

        <section
          className="dashboard-allocation overview-allocation"
          aria-labelledby="allocation-title"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line pb-4">
            <div>
              <h2 id="allocation-title">კრიპტო აქტივების განაწილება</h2>
              <p className="mt-1 text-xs text-muted">
                სტეიბლკოინებისა და ნაღდი ფულის გარეშე
              </p>
            </div>
            <Link
              href={base + "/allocation"}
              className="button-secondary shrink-0"
            >
              მართვა <ArrowUpRight size={14} />
            </Link>
          </div>
          {!s.complete ? (
            <div className="dashboard-empty">
              ყველა აქტივის ფასის მიღების შემდეგ განაწილება სრულად გამოჩნდება.
            </div>
          ) : !crypto.length ? (
            <div className="dashboard-empty">
              არასტეიბლ კრიპტოაქტივები ჯერ არ გაქვთ.
            </div>
          ) : (
            <div className="crypto-distribution">
              <div className="crypto-distribution-layout">
                <div className="crypto-distribution-chart">
                  <div
                    className="crypto-distribution-ring"
                    style={{
                      background: `conic-gradient(${allocationGradient})`,
                    }}
                  >
                    <div>
                      <span>სულ</span>
                      <strong className="numeric">
                        <BalanceValue>
                          {money(cryptoTotal.toString(), true)}
                        </BalanceValue>
                      </strong>
                      <small>{crypto.length} აქტივი</small>
                    </div>
                  </div>
                  <div
                    className="crypto-distribution-spectrum"
                    aria-hidden="true"
                  >
                    {slices.map((slice) => (
                      <span
                        key={slice.position.assetId}
                        style={{
                          flexGrow: Number(slice.share),
                          background: slice.color,
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div className="crypto-distribution-assets">
                  <div className="crypto-distribution-labels">
                    <span>აქტივი</span>
                    <span>წილი</span>
                  </div>
                  <ul className="crypto-distribution-list">
                    {primarySlices.map((slice, index) => (
                      <li key={slice.position.assetId}>
                        <Link
                          href={`${base}/positions/${slice.position.assetId}`}
                          className="crypto-distribution-asset"
                        >
                          <AssetIcon
                            symbol={slice.label}
                            logoUrl={slice.position.asset.logoUrl}
                            index={index}
                          />
                          <div className="crypto-distribution-identity">
                            <strong>{slice.label}</strong>
                            <span className="numeric">
                              <BalanceValue>
                                {money(slice.position.value)}
                              </BalanceValue>
                            </span>
                          </div>
                          <strong className="crypto-distribution-share numeric">
                            {percentage(slice.share)}
                          </strong>
                          <ArrowUpRight
                            size={13}
                            className="crypto-distribution-arrow"
                          />
                        </Link>
                      </li>
                    ))}
                    {remainingSlices.length > 0 && (
                      <li>
                        <div className="crypto-distribution-asset crypto-distribution-other">
                          <span className="crypto-distribution-other-icon">
                            +{remainingSlices.length}
                          </span>
                          <div className="crypto-distribution-identity">
                            <strong>სხვა აქტივები</strong>
                            <span className="numeric">
                              <BalanceValue>
                                {money(remainingValue.toString())}
                              </BalanceValue>
                            </span>
                          </div>
                          <strong className="crypto-distribution-share numeric">
                            {percentage(remainingShare.toString())}
                          </strong>
                        </div>
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </section>

        <section
          className="dashboard-metrics overview-kpis"
          aria-label="პორტფელის მაჩვენებლები"
        >
          <DashboardMetric
            icon={<Wallet size={16} />}
            label="წმინდა შეტანილი კაპიტალი"
            value={money(netCapital)}
            hint="შეტანები მინუს გატანები"
            sensitive
          />
          <DashboardMetric
            icon={<CircleDollarSign size={16} />}
            label="რეალიზებული P/L"
            value={money(s.realizedPnl)}
            tone={pnlClass(s.realizedPnl)}
            hint="დახურული გარიგებების შედეგი"
            sensitive
          />
          <DashboardMetric
            icon={<TrendingUp size={16} />}
            label="არარეალიზებული P/L"
            value={money(s.unrealizedPnl)}
            tone={pnlClass(s.unrealizedPnl)}
            hint="მიმდინარე პოზიციების შედეგი"
            sensitive
          />
          <DashboardMetric
            icon={<Activity size={16} />}
            label="აქტიური პოზიციები"
            value={String(positions.length)}
            hint="მიმდინარე აქტივები"
          />
        </section>

        <section
          className="dashboard-positions"
          aria-labelledby="positions-title"
        >
          <header>
            <h2 id="positions-title">ჩემი აქტივები</h2>
            <Link className="button-secondary" href={base + "/positions"}>
              ყველა პოზიცია <ArrowUpRight size={15} />
            </Link>
          </header>
          <PositionsTable positions={s.positions} base={base} />
        </section>

        <aside
          className="dashboard-side-stack"
          aria-label="პორტფელის დამატებითი ინფორმაცია"
        >
          <section className="overview-insight overview-liquidity">
            <div className="mb-4 flex items-center gap-2">
              <Wallet size={17} className="text-brand" />
              <h2>ლიკვიდობა</h2>
            </div>
            <p className="numeric text-2xl font-semibold">
              <BalanceValue>{money(s.liquidity)}</BalanceValue>
            </p>
            <p className="mt-1 text-xs text-muted">
              პორტფელის{" "}
              {percentage(
                s.value && s.liquidity !== null
                  ? percent(s.liquidity, s.value)
                  : null,
              )}
            </p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-raised">
              <div
                className="h-full rounded-full bg-brand"
                style={{
                  width:
                    Math.max(
                      0,
                      Math.min(
                        100,
                        Number(
                          s.value && s.liquidity !== null
                            ? percent(s.liquidity, s.value)
                            : 0,
                        ),
                      ),
                    ) + "%",
                }}
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4 text-xs">
              <div>
                <p className="text-muted">ნაღდი ფული</p>
                <strong className="numeric mt-1 block text-sm">
                  <BalanceValue>{money(s.cash)}</BalanceValue>
                </strong>
              </div>
              <div>
                <p className="text-muted">სტეიბლკოინები</p>
                <strong className="numeric mt-1 block text-sm">
                  <BalanceValue>{money(s.stablecoinValue)}</BalanceValue>
                </strong>
              </div>
            </div>
          </section>
          <section className="overview-insight overview-concentration">
            <h2>კონცენტრაცია</h2>
            <p className="mt-3 text-xs text-muted">უდიდესი არასტეიბლ პოზიცია</p>
            <div className="mt-2 flex items-baseline justify-between gap-3">
              <strong className="text-lg">
                {largest?.asset.symbol ?? "—"}
              </strong>
              <strong className="numeric text-lg text-brand">
                {s.complete ? percentage(largest?.allocation ?? null) : "—"}
              </strong>
            </div>
            <p className="mt-2 text-xs text-muted">წილი მთელ პორტფელში</p>
          </section>
        </aside>
      </div>
    </>
  );
}

function OverviewNextActions({
  items,
}: {
  items: {
    tone: string;
    icon: React.ReactNode;
    title: string;
    detail: string;
    href: string;
    action: string;
  }[];
}) {
  if (!items.length) return null;
  return (
    <section className="overview-next-actions" aria-label="შემდეგი ნაბიჯები">
      <header>
        <div>
          <span>შემდეგი ნაბიჯები</span>
          <p>პორტფელის მიმდინარე მონაცემებზე დაფუძნებული შემოწმებები</p>
        </div>
      </header>
      <div>
        {items.map((item) => (
          <article key={item.title} className={item.tone}>
            <span className="overview-next-icon">{item.icon}</span>
            <div>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </div>
            <Link href={item.href}>
              {item.action}
              <ArrowUpRight size={13} />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

function DashboardMetric({
  icon,
  label,
  value,
  hint,
  tone = "text-foreground",
  sensitive = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  tone?: string;
  sensitive?: boolean;
}) {
  return (
    <article className="dashboard-metric">
      <span className="overview-metric-icon">{icon}</span>
      <div>
        <p>{label}</p>
        <strong className={`numeric ${tone}`}>
          {sensitive ? <BalanceValue>{value}</BalanceValue> : value}
        </strong>
        <small>{hint}</small>
      </div>
    </article>
  );
}

export function Metric({
  label,
  value,
  hint,
  tone = "text-foreground",
  sensitive = false,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
  sensitive?: boolean;
}) {
  return (
    <div className="min-w-0 p-5">
      <p className="text-xs leading-5 text-muted" title={hint}>
        {label}
      </p>
      <p className={`numeric mt-2 text-xl font-semibold ${tone}`}>
        {sensitive ? <BalanceValue>{value}</BalanceValue> : value}
      </p>
    </div>
  );
}
