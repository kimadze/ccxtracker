import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";
import type { PortfolioSummary } from "@/domain/types";
import { decimal, percent } from "@/domain/decimal";
import {
  dateTime,
  money,
  percentage,
  pnlClass,
  quantity,
} from "@/lib/formatters";
import { AssetIcon } from "./positions";
import { BalanceValue } from "./ui";
import { OverviewToolbar } from "./overview-toolbar";
import { OverviewAssets } from "./overview-assets";

export function Overview({
  summary: s,
  base,
  cryptoOnlyValue = false,
  history,
  action,
  transactionsPanel,
}: {
  summary: PortfolioSummary;
  base: string;
  portfolioName: string;
  cryptoOnlyValue?: boolean;
  history?: ReactNode;
  action?: ReactNode;
  transactionsPanel: ReactNode;
}) {
  const positions = [...s.positions].sort((a, b) =>
    decimal(b.value ?? 0).cmp(a.value ?? 0),
  );
  const crypto = positions.filter(
    (p) => !p.asset.isStablecoin && decimal(p.value ?? 0).gt(0),
  );
  const cryptoTotal = crypto.reduce(
    (sum, p) => sum.plus(p.value ?? 0),
    decimal(0),
  );
  const displayedValue = cryptoOnlyValue
    ? cryptoTotal.toFixed()
    : (s.value ?? s.knownValue);
  const netCapital =
    s.contributions !== null && s.withdrawals !== null
      ? decimal(s.contributions).minus(s.withdrawals).toFixed()
      : null;
  const updatedAt = s.positions
    .map((p) => p.quote?.updatedAt)
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1);
  const freshness = !s.positions.length
    ? "აქტივები ჯერ არ არის"
    : s.stale
      ? "ფასები დაგვიანებულია"
      : s.complete
        ? "ფასები განახლებულია"
        : "ფასები არასრულია";
  const palette = [
    { className: "bg-primary", color: "var(--color-primary)" },
    { className: "bg-info", color: "var(--color-info)" },
    { className: "bg-accent", color: "var(--color-accent)" },
    { className: "bg-warning", color: "var(--color-warning)" },
    { className: "bg-secondary", color: "var(--color-secondary)" },
  ];
  const segments = crypto.slice(0, 4).map((p, i) => ({
    label: p.asset.symbol,
    ...palette[i],
    share: cryptoTotal.gt(0)
      ? Number(percent(p.value ?? "0", cryptoTotal.toFixed()) ?? 0)
      : 0,
  }));
  if (crypto.length > 4)
    segments.push({
      label: "სხვა",
      ...palette[4],
      share: Math.max(0, 100 - segments.reduce((sum, p) => sum + p.share, 0)),
    });
  const gradient = segments
    .map((p, index) => {
      const start = segments
        .slice(0, index)
        .reduce((sum, segment) => sum + segment.share, 0);
      return `${p.color} ${start}% ${Math.min(100, start + p.share)}%`;
    })
    .join(", ");
  const allocation = (
    <>
      {segments.length ? (
        <div className="flex min-w-0 items-center gap-3">
          <div
            role="img"
            aria-label="კრიპტოაქტივების განაწილება"
            className="relative grid size-24 shrink-0 place-items-center rounded-full"
            style={{ background: `conic-gradient(${gradient})` }}
          >
            <div className="absolute inset-[14px] rounded-full bg-base-200" />
            <span className="relative max-w-20 overflow-x-auto whitespace-nowrap text-center text-[11px] font-semibold tabular-nums">
              <BalanceValue>{money(cryptoTotal.toFixed(), true)}</BalanceValue>
            </span>
          </div>
          <ul className="list min-w-0 flex-1 space-y-1.5 text-xs">
            {segments.map((p) => (
              <li
                key={p.label}
                className="list-row flex min-w-0 items-center gap-1.5 p-0"
              >
                <span
                  className={`size-2 shrink-0 rounded-full ${p.className}`}
                />
                <span className="min-w-0 flex-1 truncate">{p.label}</span>
                <span className="shrink-0 tabular-nums text-base-content/60">
                  <BalanceValue>{percentage(String(p.share))}</BalanceValue>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="py-2 text-xs text-base-content/55">
          აქტივები ჯერ არ არის
        </p>
      )}
    </>
  );
  const liquidityShare =
    s.value !== null && decimal(s.value).gt(0) && s.liquidity !== null
      ? percent(s.liquidity, s.value)
      : null;
  const liquidityDetails = (
    <dl className="space-y-2 text-xs">
      <div className="flex items-baseline justify-between gap-2">
        <dt className="text-base-content/60">ნაღდი ფული</dt>
        <dd className="whitespace-nowrap tabular-nums">
          <BalanceValue>{money(s.cash)}</BalanceValue>
        </dd>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <dt className="text-base-content/60">სტეიბლკოინები</dt>
        <dd className="whitespace-nowrap tabular-nums">
          <BalanceValue>{money(s.stablecoinValue)}</BalanceValue>
        </dd>
      </div>
      {positions
        .filter((p) => p.asset.isStablecoin)
        .map((p) => (
          <div
            key={p.assetId}
            className="flex items-center justify-between gap-2 border-t border-base-300 pt-2 lg:hidden"
          >
            <dt className="flex min-w-0 items-center gap-2">
              <AssetIcon
                symbol={p.asset.symbol}
                logoUrl={p.asset.logoUrl}
                size={20}
                index={0}
              />
              {p.asset.symbol}
            </dt>
            <dd className="min-w-0 overflow-x-auto whitespace-nowrap text-right tabular-nums">
              <BalanceValue>
                {quantity(p.quantity)} {p.asset.symbol}
              </BalanceValue>
            </dd>
          </div>
        ))}
    </dl>
  );
  const metrics = [
    ["წმინდა კაპიტალი", money(netCapital)],
    ["რეალიზებული P/L", money(s.realizedPnl)],
    ["არარეალიზებული P/L", money(s.unrealizedPnl)],
    [
      "პოზიციები",
      String(positions.filter((p) => !p.asset.isStablecoin).length),
    ],
  ];
  const secondary = (
    <dl className="grid gap-3 text-xs sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map(([label, value], i) => (
        <div
          key={label}
          className="flex min-w-0 items-baseline justify-between gap-2 sm:block"
        >
          <dt className="text-base-content/55">{label}</dt>
          <dd className="overflow-x-auto whitespace-nowrap text-sm font-medium tabular-nums sm:mt-1">
            {i < 3 ? <BalanceValue>{value}</BalanceValue> : value}
          </dd>
        </div>
      ))}
    </dl>
  );
  const status = (
    <details className="dropdown dropdown-end">
      <summary
        className="btn btn-ghost btn-square min-h-11 min-w-11"
        aria-label="ფასების განახლების სტატუსი"
      >
        <span
          className={`status status-xs ${s.complete && !s.stale ? "status-success" : "status-warning"}`}
        />
      </summary>
      <div className="dropdown-content z-30 w-56 rounded-box border border-base-300 bg-base-200 p-3 text-xs shadow-lg">
        {freshness}
        {updatedAt && <p className="mt-2">{dateTime(updatedAt)}</p>}
      </div>
    </details>
  );
  const ProfitIcon =
    s.totalPnl !== null && decimal(s.totalPnl).lt(0)
      ? TrendingDown
      : TrendingUp;
  return (
    <div className="overview-dashboard w-full min-w-0 space-y-3 lg:space-y-4">
      <h1 className="sr-only">პორტფელის მიმოხილვა</h1>
      <OverviewToolbar>
        {status}
        {action}
      </OverviewToolbar>
      <section
        className="card card-border min-w-0 border-base-300 bg-base-200"
        aria-label="პორტფელის ღირებულება და შედეგი"
      >
        <div className="grid min-w-0 gap-2 p-3 sm:grid-cols-2 sm:gap-3 sm:p-4 sm:items-center">
          <div className="relative min-w-0 pr-10 lg:pr-0">
            <h2 className="text-xs text-base-content/60">
              {cryptoOnlyValue
                ? "კრიპტოაქტივების ღირებულება"
                : !s.complete
                  ? "ცნობილი ღირებულება"
                  : "პორტფელის ღირებულება"}
            </h2>
            <p className="mt-1 overflow-x-auto whitespace-nowrap text-[32px] leading-tight font-semibold tracking-tight tabular-nums lg:text-4xl">
              <BalanceValue>{money(displayedValue)}</BalanceValue>
            </p>
            <div className="absolute top-0 right-0 lg:hidden">{status}</div>
          </div>
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 sm:block">
            <h2 className="text-xs text-base-content/60">სრული P/L</h2>
            <p
              className={`flex min-w-0 items-center gap-1.5 overflow-x-auto whitespace-nowrap text-lg font-semibold tabular-nums sm:mt-1 lg:text-xl ${pnlClass(s.totalPnl)}`}
            >
              <ProfitIcon size={18} className="shrink-0" />
              <BalanceValue>{money(s.totalPnl)}</BalanceValue>
            </p>
          </div>
          {(!s.complete || s.stale) && (
            <p role="status" className="text-xs text-warning sm:col-span-2">
              {!s.complete
                ? "ზოგი აქტივის ფასი მიუწვდომელია · ჯამი არასრულია"
                : "ფასები დაგვიანებულია"}
            </p>
          )}
        </div>
      </section>
      <div className="grid min-w-0 grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,7fr)_minmax(235px,3fr)] lg:gap-4">
        <section
          className="card card-border min-w-0 border-base-300 bg-base-200"
          aria-label="ღირებულება და ისტორია"
        >
          <div className="card-body gap-2 p-3! sm:p-4!">
            <h2 className="text-xs font-medium text-base-content/70">
              პორტფელის ისტორია · სრული ღირებულება
            </h2>
            <div
              id="overview-period-controls"
              className="min-w-0 max-w-full empty:hidden"
            />
            {history ?? (
              <p className="py-2 text-xs text-base-content/55">
                ისტორია ჯერ არ არის
              </p>
            )}
          </div>
        </section>
        <aside
          className="grid min-w-0 items-start gap-3 md:grid-cols-2 lg:grid-cols-1 lg:gap-4"
          aria-label="პორტფელის სტრუქტურა"
        >
          <section
            className="card card-border min-w-0 border-base-300 bg-base-200"
            aria-label="USD ნაშთი და სტეიბლკოინები"
          >
            <details className="collapse collapse-arrow lg:hidden">
              <summary className="collapse-title flex min-h-14 min-w-0 flex-wrap items-baseline gap-2 py-3 pr-10 text-xs">
                <span className="mr-auto text-base-content/65">ლიკვიდობა</span>
                <span className="overflow-x-auto whitespace-nowrap text-base font-semibold tabular-nums">
                  <BalanceValue>{money(s.liquidity)}</BalanceValue>
                </span>
                <span className="text-base-content/50">
                  <BalanceValue>{percentage(liquidityShare)}</BalanceValue>
                </span>
              </summary>
              <div className="collapse-content">{liquidityDetails}</div>
            </details>
            <div className="card-body hidden gap-2 p-3! lg:flex">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-xs text-base-content/65">ლიკვიდობა</h2>
                <span className="text-xs tabular-nums text-base-content/50">
                  <BalanceValue>{percentage(liquidityShare)}</BalanceValue>
                </span>
              </div>
              <p className="overflow-x-auto whitespace-nowrap text-xl font-semibold tabular-nums">
                <BalanceValue>{money(s.liquidity)}</BalanceValue>
              </p>
              {liquidityShare !== null ? (
                <progress
                  className="progress progress-accent h-1.5 w-full"
                  value={Math.max(
                    0,
                    Math.min(100, Number(liquidityShare ?? 0)),
                  )}
                  max={100}
                  aria-label="ლიკვიდობის წილი სრულ პორტფელში"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="h-1.5 rounded-full bg-base-300"
                />
              )}
              {liquidityDetails}
            </div>
          </section>
          <section className="card card-border hidden min-w-0 border-base-300 bg-base-200 md:block">
            <div className="card-body gap-2 p-3!">
              <div className="flex items-center justify-between gap-1">
                <h2 className="text-xs font-medium text-base-content/70">
                  კრიპტო განაწილება
                </h2>
                <Link
                  className="btn btn-ghost btn-square btn-sm min-h-11 min-w-11 text-base-content/50"
                  href={base + "/planning?tab=allocation"}
                  aria-label="განაწილების გახსნა"
                >
                  <ArrowUpRight size={15} />
                </Link>
              </div>
              {allocation}
            </div>
          </section>
        </aside>
        <OverviewAssets
          positions={positions}
          base={base}
          transactionsPanel={transactionsPanel}
        />
        <details className="collapse collapse-arrow border border-base-300 bg-base-200 md:hidden">
          <summary className="collapse-title min-h-11 py-3 text-sm">
            კრიპტო განაწილება
          </summary>
          <div className="collapse-content">
            {allocation}
            <Link
              href={base + "/planning?tab=allocation"}
              className="btn btn-ghost btn-sm mt-2 min-h-11 px-0 text-xs"
            >
              განაწილების გახსნა <ArrowUpRight size={14} />
            </Link>
          </div>
        </details>
        <details className="collapse collapse-arrow border border-base-300 bg-base-200 lg:col-span-2">
          <summary className="collapse-title min-h-11 py-3 text-xs text-base-content/60">
            დამატებითი მაჩვენებლები
          </summary>
          <div className="collapse-content">{secondary}</div>
        </details>
      </div>
    </div>
  );
}
export function Metric({
  label,
  value,
  hint,
  tone = "",
  sensitive = false,
  compact = false,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
  sensitive?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={`stat min-w-0 grid-cols-[minmax(0,1fr)] [container-type:inline-size] ${compact ? "px-0 py-1" : "p-3"}`}
    >
      <div className="stat-title whitespace-normal text-xs" title={hint}>
        {label}
      </div>
      <div
        className={`stat-value min-w-0 max-w-full overflow-x-auto whitespace-nowrap text-lg tabular-nums ${tone}`}
        style={
          value.length > 12
            ? { fontSize: `clamp(0.75rem, ${120 / value.length}cqi, 1.125rem)` }
            : undefined
        }
      >
        {sensitive ? <BalanceValue>{value}</BalanceValue> : value}
      </div>
      {hint && (
        <div className="stat-desc whitespace-normal text-xs">{hint}</div>
      )}
    </div>
  );
}
