import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";
import type { PortfolioSummary } from "@/domain/types";
import { decimal, percent } from "@/domain/decimal";
import {
  dateTime,
  money,
  percentage,
  pnlClass,
  unitPrice,
} from "@/lib/formatters";
import { AssetIcon } from "./positions";
import { BalanceValue } from "./ui";
import { OverviewToolbar } from "./overview-toolbar";

export function Overview({
  summary: s,
  base,
  cryptoOnlyValue = false,
  history,
  action,
}: {
  summary: PortfolioSummary;
  base: string;
  portfolioName: string;
  cryptoOnlyValue?: boolean;
  history?: ReactNode;
  action?: ReactNode;
}) {
  const positions = [...s.positions].sort(
    (a, b) => Number(b.value ?? 0) - Number(a.value ?? 0),
  );
  const crypto = positions.filter(
    (position) =>
      !position.asset.isStablecoin && Number(position.value ?? 0) > 0,
  );
  const cryptoTotal = crypto.reduce(
    (sum, position) => sum.plus(position.value ?? 0),
    decimal(0),
  );
  const displayedValue = cryptoOnlyValue
    ? cryptoTotal.toString()
    : (s.value ?? s.knownValue);
  const liquidityShare =
    s.value && s.liquidity !== null ? percent(s.liquidity, s.value) : null;
  const netCapital =
    s.contributions !== null && s.withdrawals !== null
      ? decimal(s.contributions).minus(s.withdrawals).toString()
      : null;
  const updatedAt = positions
    .map((position) => position.quote?.updatedAt)
    .filter((date): date is string => Boolean(date))
    .sort()
    .at(-1);
  const freshness = !positions.length
    ? "აქტივები ჯერ არ არის"
    : s.stale
      ? "ფასები დაგვიანებულია"
      : s.complete
        ? "ფასები განახლებულია"
        : "ფასები არასრულია";
  const allocationColors = [
    "bg-primary",
    "bg-info",
    "bg-accent",
    "bg-warning",
    "bg-secondary",
  ];
  const segments = crypto.slice(0, 4).map((position, index) => ({
    label: position.asset.symbol,
    color: allocationColors[index],
    share: cryptoTotal.gt(0)
      ? Number(percent(position.value ?? "0", cryptoTotal.toString()) ?? 0)
      : 0,
  }));
  if (crypto.length > 4) {
    segments.push({
      label: "სხვა",
      color: allocationColors[4],
      share: Math.max(
        0,
        100 - segments.reduce((sum, segment) => sum + segment.share, 0),
      ),
    });
  }

  const status = (
    <details className="dropdown dropdown-end">
      <summary
        className="btn btn-ghost min-h-11 gap-2 px-2 text-xs"
        aria-label="ფასების განახლების სტატუსი"
      >
        <span
          className={`status status-xs ${s.complete && !s.stale ? "status-success" : "status-warning"}`}
        />
        <span className="hidden xl:inline">{freshness}</span>
      </summary>
      <div className="dropdown-content z-30 w-56 rounded-box border border-base-300 bg-base-200 p-3 text-xs shadow-lg">
        {freshness}
        {updatedAt && <p className="mt-2">{dateTime(updatedAt)}</p>}
      </div>
    </details>
  );

  const secondaryMetrics = [
    ["წმინდა კაპიტალი", money(netCapital)],
    ["რეალიზებული P/L", money(s.realizedPnl)],
    ["არარეალიზებული P/L", money(s.unrealizedPnl)],
    ["პოზიციები", String(positions.length)],
  ] as const;
  const secondary = (
    <dl className="space-y-3 text-sm">
      {secondaryMetrics.map(([label, value], index) => (
        <div
          key={label}
          className="flex flex-wrap items-baseline justify-between gap-2"
        >
          <dt className="text-base-content/60">{label}</dt>
          <dd className="numeric whitespace-nowrap font-medium">
            {index < 3 ? <BalanceValue>{value}</BalanceValue> : value}
          </dd>
        </div>
      ))}
    </dl>
  );
  const allocation = (
    <div className="space-y-3">
      {segments.length ? (
        <>
          <div className="flex h-2 overflow-hidden rounded-full bg-base-300">
            {segments.map((segment) => (
              <span
                key={segment.label}
                className={segment.color}
                style={{ width: `${segment.share}%` }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
            {segments.map((segment) => (
              <span key={segment.label} className="flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${segment.color}`} />
                {segment.label}
                <span className="numeric text-base-content/60">
                  {percentage(String(segment.share))}
                </span>
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className="text-xs text-base-content/60">აქტივები ჯერ არ არის</p>
      )}
      <Link
        href={base + "/allocation"}
        className="btn btn-ghost min-h-11 px-2 text-xs"
      >
        განაწილების ნახვა <ArrowUpRight size={16} />
      </Link>
    </div>
  );
  const liquidityDetails = (
    <dl className="space-y-3 text-sm">
      <div className="flex flex-wrap justify-between gap-2">
        <dt className="text-base-content/60">ნაღდი ფული</dt>
        <dd className="numeric whitespace-nowrap">
          <BalanceValue>{money(s.cash)}</BalanceValue>
        </dd>
      </div>
      <div className="flex flex-wrap justify-between gap-2">
        <dt className="text-base-content/60">სტეიბლკოინები</dt>
        <dd className="numeric whitespace-nowrap">
          <BalanceValue>{money(s.stablecoinValue)}</BalanceValue>
        </dd>
      </div>
    </dl>
  );

  return (
    <div className="overview-page w-full min-w-0">
      <h1 className="sr-only">პორტფელის მიმოხილვა</h1>
      <OverviewToolbar>
        {status}
        {action}
      </OverviewToolbar>

      <div className="overview-grid grid min-w-0 grid-cols-1 items-start gap-3 md:gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(300px,.85fr)]">
        <section
          className="card card-border overview-hero min-w-0 bg-base-200 lg:col-start-1 lg:row-start-1"
          aria-label="ღირებულება და ისტორია"
        >
          <div className="card-body gap-4 p-3! sm:p-5!">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="eyebrow">პორტფელის მიმოხილვა</p>
                <h2 className="mt-1 text-sm font-semibold">
                  {cryptoOnlyValue
                    ? "კრიპტოაქტივების ღირებულება"
                    : "პორტფელის ღირებულება"}
                </h2>
              </div>
              <div className="lg:hidden">{status}</div>
            </div>

            <div className="overview-balance-surface rounded-box p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="numeric overflow-x-auto whitespace-nowrap text-[30px] font-semibold leading-tight tracking-[-.06em] text-base-content sm:text-[38px] lg:text-[44px]">
                    <BalanceValue>{money(displayedValue)}</BalanceValue>
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span
                      className={`numeric whitespace-nowrap text-sm font-semibold ${pnlClass(s.totalPnl)}`}
                    >
                      <BalanceValue>{money(s.totalPnl)}</BalanceValue>
                    </span>
                    <span className="text-xs text-base-content/65">
                      მთლიანი P/L
                    </span>
                  </div>
                </div>
                <span
                  className="overview-balance-mark grid size-10 shrink-0 place-items-center rounded-box bg-primary/15 text-primary"
                  aria-hidden="true"
                >
                  <Sparkles size={19} />
                </span>
              </div>
              {(!s.complete || s.stale) && (
                <p role="status" className="mt-4 text-xs text-warning">
                  {!s.complete
                    ? "ზოგი აქტივის ფასი მიუწვდომელია"
                    : "ფასები დაგვიანებულია"}
                </p>
              )}
            </div>

            <div className="overview-history min-w-0 border-t border-base-300 pt-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-xs font-medium text-base-content/65">
                  ისტორია · ლიკვიდობის ჩათვლით
                </h2>
                <span className="text-[11px] text-base-content/45">
                  შეფასებები
                </span>
              </div>
              {history ?? (
                <p className="py-3 text-xs text-base-content/60">
                  ისტორია ჯერ არ არის საკმარისი.
                </p>
              )}
            </div>
          </div>
        </section>

        <aside className="overview-side contents lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:flex lg:min-w-0 lg:flex-col lg:gap-4">
          <details className="collapse collapse-arrow order-2 border border-base-300 bg-base-200 lg:hidden">
            <summary className="collapse-title flex min-h-14 items-center justify-between gap-3 pr-10 text-sm">
              <span className="font-semibold">ლიკვიდობა</span>
              <span className="numeric whitespace-nowrap text-right">
                <BalanceValue>{money(s.liquidity)}</BalanceValue>
                <span className="ml-2 text-xs text-base-content/60">
                  {percentage(liquidityShare)}
                </span>
              </span>
            </summary>
            <div className="collapse-content">{liquidityDetails}</div>
          </details>
          <section className="card card-border hidden w-full bg-base-200 lg:block">
            <div className="card-body gap-3 p-4!">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">ლიკვიდობა</h2>
                <span className="status status-info status-xs" />
              </div>
              <p className="numeric overflow-x-auto whitespace-nowrap text-2xl font-semibold tracking-[-.04em]">
                <BalanceValue>{money(s.liquidity)}</BalanceValue>
              </p>
              <div className="flex items-center gap-3">
                <progress
                  className="progress progress-info h-1.5 flex-1"
                  value={Number(liquidityShare ?? 0)}
                  max="100"
                  aria-label="ლიკვიდობის წილი"
                />
                <span className="numeric text-xs text-base-content/60">
                  {percentage(liquidityShare)}
                </span>
              </div>
              <details className="collapse collapse-arrow -mx-1 rounded-field bg-base-100">
                <summary className="collapse-title min-h-11 py-3 text-xs">
                  დეტალები
                </summary>
                <div className="collapse-content">{liquidityDetails}</div>
              </details>
            </div>
          </section>

          <details className="collapse collapse-arrow order-4 border border-base-300 bg-base-200 lg:hidden">
            <summary className="collapse-title min-h-11 py-3 text-sm font-semibold">
              კრიპტო განაწილება
            </summary>
            <div className="collapse-content">{allocation}</div>
          </details>
          <section className="card card-border hidden w-full bg-base-200 lg:block">
            <div className="card-body gap-3 p-4!">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">კრიპტო განაწილება</h2>
                <Link
                  href={base + "/allocation"}
                  className="btn btn-ghost btn-square"
                  aria-label="განაწილების ნახვა"
                  title="განაწილების ნახვა"
                >
                  <ArrowUpRight size={16} />
                </Link>
              </div>
              {allocation}
            </div>
          </section>

          <details className="collapse collapse-arrow order-5 w-full border border-base-300 bg-base-200">
            <summary className="collapse-title min-h-11 py-3 text-sm font-semibold">
              დამატებითი მაჩვენებლები
            </summary>
            <div className="collapse-content">{secondary}</div>
          </details>
        </aside>

        <section className="card card-border order-3 min-w-0 bg-base-200 lg:col-start-1 lg:row-start-2">
          <div className="card-body gap-0 p-3! sm:p-4!">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="eyebrow">პორტფელის შემადგენლობა</p>
                <h2 className="mt-1 text-sm font-semibold">აქტივები</h2>
              </div>
              <Link
                href={base + "/positions"}
                className="btn btn-ghost min-h-11 px-2 text-xs"
              >
                ყველა <ArrowUpRight size={16} />
              </Link>
            </div>

            <ul className="list mt-2 lg:hidden">
              {positions.slice(0, 6).map((position, index) => (
                <li
                  key={position.assetId}
                  className="border-b border-base-300 last:border-0"
                >
                  <Link
                    href={base + "/positions/" + position.assetId}
                    className="overview-asset-row flex min-h-[64px] items-center gap-3 rounded-field py-2"
                  >
                    <AssetIcon
                      symbol={position.asset.symbol}
                      logoUrl={position.asset.logoUrl}
                      index={index}
                      size={34}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {position.asset.symbol}
                      </span>
                      <span
                        className="block truncate text-xs text-base-content/55"
                        title={position.asset.name}
                      >
                        {position.asset.name}
                      </span>
                    </span>
                    <span className="min-w-0 text-right">
                      <span className="numeric block whitespace-nowrap text-sm font-semibold">
                        <BalanceValue>{money(position.value)}</BalanceValue>
                      </span>
                      <span
                        className={`numeric block text-xs ${pnlClass(position.returnPercent)}`}
                      >
                        {percentage(position.returnPercent, true)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-2 hidden overflow-x-auto lg:block">
              <table className="table table-sm text-xs! [&_td]:px-2! [&_th]:px-2!">
                <thead>
                  <tr>
                    <th>აქტივი</th>
                    <th className="text-right">ფასი</th>
                    <th className="text-right">ღირებულება</th>
                    <th className="text-right">P/L</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.slice(0, 6).map((position, index) => (
                    <tr key={position.assetId} className="overview-asset-row">
                      <td>
                        <Link
                          href={base + "/positions/" + position.assetId}
                          className="flex min-h-11 items-center gap-2"
                        >
                          <AssetIcon
                            symbol={position.asset.symbol}
                            logoUrl={position.asset.logoUrl}
                            index={index}
                            size={32}
                          />
                          <span className="min-w-0">
                            <span className="block font-semibold">
                              {position.asset.symbol}
                            </span>
                            <span
                              className="block max-w-32 truncate text-xs text-base-content/60"
                              title={position.asset.name}
                            >
                              {position.asset.name}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="numeric whitespace-nowrap text-right">
                        {unitPrice(position.quote?.price)}
                      </td>
                      <td className="numeric whitespace-nowrap text-right font-semibold">
                        <BalanceValue>{money(position.value)}</BalanceValue>
                      </td>
                      <td
                        className={`numeric whitespace-nowrap text-right ${pnlClass(position.returnPercent)}`}
                      >
                        {percentage(position.returnPercent, true)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!positions.length && (
              <div className="alert alert-info alert-soft mt-3 text-xs">
                პოზიციები ჯერ არ არის.
              </div>
            )}
          </div>
        </section>
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
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
  sensitive?: boolean;
}) {
  return (
    <div className="stat min-w-0 p-3">
      <div className="stat-title whitespace-normal text-xs" title={hint}>
        {label}
      </div>
      <div
        className={`stat-value numeric overflow-x-auto whitespace-nowrap text-lg ${tone}`}
      >
        {sensitive ? <BalanceValue>{value}</BalanceValue> : value}
      </div>
      {hint && (
        <div className="stat-desc whitespace-normal text-xs">{hint}</div>
      )}
    </div>
  );
}
