import Link from "next/link";
import type { ReactNode } from "react";
import {
  Banknote,
  Coins,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import type { PortfolioSummary } from "@/domain/types";
import { decimal, percent } from "@/domain/decimal";
import { dailyMovers } from "@/domain/daily-movers";
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
  const movers = dailyMovers(positions);
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
  const moverRow = (
    position: (typeof positions)[number] | undefined,
    direction: "up" | "down",
  ) => {
    const isUp = direction === "up";
    const Icon = isUp ? TrendingUp : TrendingDown;
    const label = isUp ? "დღის ზრდა" : "დღის კლება";
    const tone = isUp ? "text-success" : "text-error";
    const content = (
      <>
        <span className="col-span-2 flex items-center gap-1.5 text-xs text-base-content/60">
          <Icon size={14} className={position ? tone : ""} aria-hidden="true" />
          {label}
        </span>
        {position ? (
          <>
            <span className="flex min-w-0 items-center gap-1.5 font-medium">
              <AssetIcon
                symbol={position.asset.symbol}
                logoUrl={position.asset.logoUrl}
                size={28}
              />
              <span className="truncate">{position.asset.symbol}</span>
            </span>
            <span
              className={`whitespace-nowrap text-right text-sm font-semibold tabular-nums ${tone}`}
            >
              {percentage(position.quote?.change24h, true)}
            </span>
          </>
        ) : (
          <span className="col-span-2 py-1 text-xs text-base-content/55">
            {isUp ? "ზრდა არ არის" : "კლება არ არის"}
          </span>
        )}
      </>
    );
    const rowClass =
      "grid min-h-11 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-1 gap-y-1 py-1 md:py-2";
    return (
      <li
        key={direction}
        className="list-row block min-w-0 rounded-none border-base-300 p-0 after:hidden first:border-r first:pr-3 last:pl-3 md:first:border-r-0 md:first:border-b md:first:pr-0 md:last:pl-0"
      >
        {position ? (
          <Link
            href={`${base}/positions/${encodeURIComponent(position.assetId)}`}
            className={`${rowClass} rounded-field hover:bg-base-300/40 focus-visible:outline-2 focus-visible:outline-primary`}
          >
            {content}
          </Link>
        ) : (
          <div className={rowClass}>{content}</div>
        )}
      </li>
    );
  };
  const updatedTime = movers.latestQuoteAt
    ? new Intl.DateTimeFormat("ka-GE", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Tbilisi",
      }).format(new Date(movers.latestQuoteAt))
    : null;
  const dailyMoversContent = (
    <>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-medium text-base-content/65">
          დღის ლიდერები
        </h2>
        <span className="flex shrink-0 items-center gap-1 text-xs text-base-content/55">
          <span>24 სთ</span>
          {updatedTime && (
            <time
              dateTime={movers.latestQuoteAt ?? undefined}
              title={dateTime(movers.latestQuoteAt!)}
            >
              · {updatedTime}
            </time>
          )}
        </span>
      </div>
      {movers.hasIncompleteCoverage && (
        <span
          className="badge badge-warning badge-outline badge-sm text-xs"
          title={`ფასი ხელმისაწვდომია ${movers.coveredAssets}/${movers.totalAssets} აქტივისთვის`}
        >
          ნაწილობრივი
        </span>
      )}
      {movers.hasFreshQuotes ? (
        <ul className="list grid min-w-0 grid-cols-2 md:grid-cols-1">
          {moverRow(movers.gainer, "up")}
          {moverRow(movers.loser, "down")}
        </ul>
      ) : (
        <p className="py-2 text-xs text-base-content/55">
          განახლებული 24-საათიანი ფასები მიუწვდომელია
        </p>
      )}
    </>
  );
  const liquidityShare =
    s.value !== null && decimal(s.value).gt(0) && s.liquidity !== null
      ? percent(s.liquidity, s.value)
      : null;
  const liquidityDetails = (
    <dl className="text-xs">
      {[
        {
          label: "ნაღდი ფული",
          value: s.cash,
          Icon: Banknote,
          tone: "bg-success/12 text-success",
        },
        {
          label: "სტეიბლკოინები",
          value: s.stablecoinValue,
          Icon: Coins,
          tone: "bg-info/12 text-info",
        },
      ].map(({ label, value, Icon, tone }) => (
        <div
          key={label}
          className="flex min-h-9 items-center gap-2 border-t border-base-300 first:border-0"
        >
          <span
            className="avatar avatar-placeholder shrink-0"
            aria-hidden="true"
          >
            <span
              className={`grid size-7 place-items-center rounded-full ${tone}`}
            >
              <Icon size={15} strokeWidth={1.8} />
            </span>
          </span>
          <dt className="min-w-0 flex-1 truncate text-base-content/60">
            {label}
          </dt>
          <dd className="shrink-0 whitespace-nowrap text-right tabular-nums">
            <BalanceValue>{money(value)}</BalanceValue>
          </dd>
        </div>
      ))}
      {positions
        .filter((p) => p.asset.isStablecoin)
        .map((p) => (
          <div
            key={p.assetId}
            className="flex min-h-9 items-center justify-between gap-2 border-t border-base-300 md:hidden"
          >
            <dt className="flex min-w-0 items-center gap-2 text-base-content/60">
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
  const renderStatus = (compact = false) => (
    <details className="dropdown dropdown-end">
      <summary
        className={`btn btn-ghost min-h-11 shrink-0 gap-2 text-xs ${compact ? "btn-square min-w-11" : "px-2"}`}
        aria-label="ფასების განახლების სტატუსი"
      >
        {s.complete && !s.stale ? (
          <CheckCircle2 size={16} className="text-success" aria-hidden="true" />
        ) : (
          <TriangleAlert
            size={16}
            className="text-warning"
            aria-hidden="true"
          />
        )}
        <span
          className={compact ? "sr-only" : "hidden whitespace-nowrap xl:inline"}
        >
          {s.stale
            ? "ფასები მოძველდა"
            : s.complete
              ? "ფასები ახალია"
              : "ფასები არასრულია"}
        </span>
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
        {renderStatus()}
        {action}
      </OverviewToolbar>
      <section
        className="card card-border min-w-0 border-base-300 bg-base-200"
        aria-label="პორტფელის ღირებულება და შედეგი"
      >
        <div className="grid min-w-0 items-start gap-2 p-3 sm:grid-cols-2 sm:gap-3 sm:p-4">
          <div className="min-w-0">
            <h2 className="min-h-5 text-xs text-base-content/60">
              {cryptoOnlyValue
                ? "კრიპტოაქტივების ღირებულება"
                : !s.complete
                  ? "ცნობილი ღირებულება"
                  : "პორტფელის ღირებულება"}
            </h2>
            <div className="mt-1 flex min-w-0 items-center justify-between gap-2">
              <p className="min-w-0 overflow-x-auto whitespace-nowrap text-[32px] leading-tight font-semibold tracking-tight tabular-nums lg:text-4xl">
                <BalanceValue>{money(displayedValue)}</BalanceValue>
              </p>
              <div className="shrink-0 lg:hidden">{renderStatus(true)}</div>
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 sm:block">
            <h2
              className="text-xs text-base-content/60 sm:flex sm:min-h-5 sm:items-center"
              title="რეალიზებული და არარეალიზებული შედეგი მთელ პორტფელზე"
            >
              სრული P/L
            </h2>
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
          className="card card-border min-w-0 border-base-300 bg-base-200 lg:has-[[data-history-chart-ready]]:self-stretch"
          aria-label="ღირებულება და ისტორია"
        >
          <div className="card-body gap-2 p-3! sm:p-4! lg:h-full">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="text-sm font-medium">ისტორია</h2>
              <span className="badge badge-ghost badge-sm text-xs text-base-content/65">
                სრული პორტფელი
              </span>
            </div>
            <div
              id="overview-period-controls"
              className="min-w-0 max-w-full empty:hidden [&_[role=group]]:p-0"
            />
            {history ?? (
              <p className="py-2 text-xs text-base-content/55">
                ისტორია ჯერ არ არის
              </p>
            )}
          </div>
        </section>
        <aside
          className="grid min-w-0 items-stretch gap-3 md:grid-cols-2 lg:grid-cols-1 lg:gap-4"
          aria-label="პორტფელის სტრუქტურა"
        >
          <section
            className="card card-border min-w-0 border-base-300 bg-base-200"
            aria-label="USD ნაშთი და სტეიბლკოინები"
          >
            <details className="collapse collapse-arrow md:hidden">
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
            <div className="card-body hidden gap-2 p-3! md:flex">
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
          <section
            className="card card-border min-w-0 border-base-300 bg-base-200"
            aria-label="დღის ლიდერები"
          >
            <div className="card-body gap-2 p-3!">{dailyMoversContent}</div>
          </section>
        </aside>
        <OverviewAssets
          positions={positions}
          base={base}
          transactionsPanel={transactionsPanel}
        />
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
