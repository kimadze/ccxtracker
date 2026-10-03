import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import type { PortfolioSummary } from "@/domain/types";
import { decimal, percent } from "@/domain/decimal";
import { dateTime, money, percentage, pnlClass, unitPrice } from "@/lib/formatters";
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
    (p) => !p.asset.isStablecoin && Number(p.value ?? 0) > 0,
  );
  const cryptoTotal = crypto.reduce(
    (sum, p) => sum.plus(p.value ?? 0),
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
    .map((p) => p.quote?.updatedAt)
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1);
  const freshness = !positions.length
    ? "აქტივები ჯერ არ არის"
    : s.stale
      ? "ფასები დაგვიანებულია"
      : s.complete
        ? "ფასები განახლებულია"
        : "ფასები არასრულია";
  const palette = [
    "bg-primary",
    "bg-info",
    "bg-accent",
    "bg-warning",
    "bg-secondary",
  ];
  const segments = crypto.slice(0, 4).map((p, i) => ({
    label: p.asset.symbol,
    color: palette[i],
    share: cryptoTotal.gt(0)
      ? Number(percent(p.value ?? "0", cryptoTotal.toString()) ?? 0)
      : 0,
  }));
  if (crypto.length > 4)
    segments.push({
      label: "სხვა",
      color: palette[4],
      share: Math.max(0, 100 - segments.reduce((sum, p) => sum + p.share, 0)),
    });
  const metrics = [
    ["წმინდა კაპიტალი", money(netCapital)],
    ["რეალიზებული P/L", money(s.realizedPnl)],
    ["არარეალიზებული P/L", money(s.unrealizedPnl)],
    ["პოზიციები", String(positions.length)],
  ];
  const secondary = (
    <dl className="space-y-3 text-sm">
      {metrics.map(([label, value], i) => (
        <div
          key={label}
          className="flex flex-wrap items-baseline justify-between gap-2"
        >
          <dt className="text-base-content/60">{label}</dt>
          <dd className="whitespace-nowrap font-medium tabular-nums">
            {i < 3 ? <BalanceValue>{value}</BalanceValue> : value}
          </dd>
        </div>
      ))}
    </dl>
  );
  const allocation = (
    <>
      {segments.length ? (
        <>
          <div className="flex h-2 overflow-hidden rounded-full bg-base-300">
            {segments.map((p) => (
              <span
                key={p.label}
                className={p.color}
                style={{ width: p.share + "%" }}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs">
            {segments.map((p) => (
              <span key={p.label} className="flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${p.color}`} />
                {p.label}{" "}
                <span className="text-base-content/60">
                  {percentage(String(p.share))}
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
        className="btn btn-ghost mt-2 min-h-11 text-xs"
      >
        განაწილება <ArrowUpRight size={16} />
      </Link>
    </>
  );
  const liquidityDetails = (
    <dl className="space-y-3 text-sm">
      <div className="flex flex-wrap justify-between gap-2">
        <dt className="text-base-content/60">ნაღდი ფული</dt>
        <dd className="whitespace-nowrap">
          <BalanceValue>{money(s.cash)}</BalanceValue>
        </dd>
      </div>
      <div className="flex flex-wrap justify-between gap-2">
        <dt className="text-base-content/60">სტეიბლკოინები</dt>
        <dd className="whitespace-nowrap">
          <BalanceValue>{money(s.stablecoinValue)}</BalanceValue>
        </dd>
      </div>
    </dl>
  );
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

  return (
    <div className="w-full min-w-0">
      <h1 className="sr-only">პორტფელის მიმოხილვა</h1>
      <OverviewToolbar>
        {status}
        {action}
      </OverviewToolbar>
      <div className="grid min-w-0 grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,7fr)_minmax(260px,3fr)] lg:gap-4">
        <section
          className="card card-border min-w-0 bg-base-200 lg:col-start-1 lg:row-start-1"
          aria-label="ღირებულება და ისტორია"
        >
          <div className="card-body gap-3 p-3! sm:p-4!">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs text-base-content/65">
                {cryptoOnlyValue
                  ? "კრიპტოაქტივების ღირებულება"
                  : "პორტფელის ღირებულება"}
              </h2>
              <div className="lg:hidden">{status}</div>
            </div>
            <div className="block w-full min-w-0">
              <div className="min-w-0 rounded-box border border-base-300 bg-base-100 p-3 text-base-content">
                <p className="overflow-x-auto whitespace-nowrap text-[32px] leading-tight font-semibold tracking-tight tabular-nums">
                  <BalanceValue>{money(displayedValue)}</BalanceValue>
                </p>
                <p className="mt-2 flex flex-wrap items-baseline gap-2 text-sm">
                  <span
                    className={`whitespace-nowrap font-semibold tabular-nums ${pnlClass(s.totalPnl)}`}
                  >
                    <BalanceValue>{money(s.totalPnl)}</BalanceValue>
                  </span>
                  <span className="text-xs text-base-content/60">
                    მთლიანი P/L
                  </span>
                </p>
              </div>
            </div>
            {(!s.complete || s.stale) && (
              <p role="status" className="text-xs text-warning">
                {!s.complete
                  ? "ზოგი აქტივის ფასი მიუწვდომელია"
                  : "ფასები დაგვიანებულია"}
              </p>
            )}
            <div className="min-w-0 border-t border-base-300 pt-3">
              <h2 className="mb-1 text-xs text-base-content/60">
                პორტფელის ისტორია · ლიკვიდობის ჩათვლით
              </h2>
              {history ?? (
                <p className="py-2 text-xs text-base-content/60">
                  ისტორია ჯერ არ არის
                </p>
              )}
            </div>
          </div>
        </section>

        <div className="grid min-w-0 items-start gap-3 md:grid-cols-2 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:flex lg:flex-col lg:items-stretch lg:gap-4">
          <details className="collapse collapse-arrow border border-base-300 bg-base-200 lg:hidden">
            <summary className="collapse-title flex min-h-14 flex-wrap items-center justify-between gap-2 py-3 pl-3 pr-10 text-sm">
              <span>ლიკვიდობა</span>
              <span className="whitespace-nowrap font-semibold tabular-nums">
                <BalanceValue>{money(s.liquidity)}</BalanceValue>
                <span className="ml-2 text-xs font-normal text-base-content/60">
                  {percentage(liquidityShare)}
                </span>
              </span>
            </summary>
            <div className="collapse-content">{liquidityDetails}</div>
          </details>
          <section className="card card-border hidden bg-base-200 lg:block">
            <div className="card-body gap-3 p-4!">
              <h2 className="text-sm font-semibold">ლიკვიდობა</h2>
              <p className="overflow-x-auto whitespace-nowrap text-2xl font-semibold tabular-nums">
                <BalanceValue>{money(s.liquidity)}</BalanceValue>
              </p>
              <div className="flex items-center gap-3">
                <progress
                  className="progress h-1.5 flex-1"
                  value={Number(liquidityShare ?? 0)}
                  max="100"
                  aria-label="ლიკვიდობის წილი"
                />
                <span className="text-xs text-base-content/60">
                  {percentage(liquidityShare)}
                </span>
              </div>
              {liquidityDetails}
            </div>
          </section>
          <section className="card card-border hidden bg-base-200 md:block">
            <div className="card-body gap-3 p-4!">
              <h2 className="text-sm font-semibold">კრიპტო განაწილება</h2>
              {allocation}
            </div>
          </section>
          <section
            className="card card-border hidden bg-base-200 lg:block"
            aria-label="დამატებითი მაჩვენებლები"
          >
            <div className="card-body p-4!">{secondary}</div>
          </section>
        </div>

        <section className="card card-border min-w-0 bg-base-200 lg:col-start-1 lg:row-start-2">
          <div className="card-body gap-0 p-3! sm:p-4!">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">აქტივები</h2>
              <Link
                href={base + "/positions"}
                className="btn btn-ghost min-h-11 px-2 text-xs"
              >
                ყველა <ArrowUpRight size={16} />
              </Link>
            </div>
            <ul className="list lg:hidden">
              {positions.slice(0, 6).map((p, i) => (
                <li
                  key={p.assetId}
                  className="border-b border-base-300 last:border-0"
                >
                  <Link
                    href={base + "/positions/" + p.assetId}
                    className="flex min-h-[60px] items-center gap-2 py-2"
                  >
                    <AssetIcon
                      symbol={p.asset.symbol}
                      logoUrl={p.asset.logoUrl}
                      index={i}
                      size={32}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {p.asset.symbol}
                    </span>
                    <span className="min-w-0 max-w-[72%] text-right tabular-nums">
                      <span className="block overflow-x-auto whitespace-nowrap text-sm font-semibold">
                        <BalanceValue>{money(p.value)}</BalanceValue>
                      </span>
                      <span
                        className={`block text-xs ${pnlClass(p.returnPercent)}`}
                      >
                        {percentage(p.returnPercent, true)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto lg:block">
              <table className="table table-sm text-xs! [&_th]:px-2! [&_td]:px-2!">
                <thead>
                  <tr>
                    <th>აქტივი</th>
                    <th className="text-right">ფასი</th>
                    <th className="text-right">ღირებულება</th>
                    <th className="text-right">P/L</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.slice(0, 6).map((p, i) => (
                    <tr key={p.assetId}>
                      <td>
                        <Link
                          href={base + "/positions/" + p.assetId}
                          className="flex min-h-11 items-center gap-2"
                        >
                          <AssetIcon
                            symbol={p.asset.symbol}
                            logoUrl={p.asset.logoUrl}
                            index={i}
                            size={32}
                          />
                          <span className="min-w-0">
                            <span className="block font-semibold">
                              {p.asset.symbol}
                            </span>
                            <span className="block max-w-16 truncate xl:max-w-32 text-xs text-base-content/60">
                              {p.asset.name}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="whitespace-nowrap text-right tabular-nums">
                        {unitPrice(p.quote?.price)}
                      </td>
                      <td className="whitespace-nowrap text-right font-semibold tabular-nums">
                        <BalanceValue>{money(p.value)}</BalanceValue>
                      </td>
                      <td
                        className={`whitespace-nowrap text-right tabular-nums ${pnlClass(p.returnPercent)}`}
                      >
                        {percentage(p.returnPercent, true)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!positions.length && (
              <p className="py-3 text-xs text-base-content/60">
                პოზიციები ჯერ არ არის
              </p>
            )}
          </div>
        </section>
        <details className="collapse collapse-arrow border border-base-300 bg-base-200 md:hidden">
          <summary className="collapse-title min-h-11 py-3 text-sm">
            კრიპტო განაწილება
          </summary>
          <div className="collapse-content">{allocation}</div>
        </details>
        <details className="collapse collapse-arrow border border-base-300 bg-base-200 lg:hidden">
          <summary className="collapse-title min-h-11 py-3 text-sm">
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
        className={`stat-value overflow-x-auto whitespace-nowrap text-lg tabular-nums ${tone}`}
      >
        {sensitive ? <BalanceValue>{value}</BalanceValue> : value}
      </div>
      {hint && (
        <div className="stat-desc whitespace-normal text-xs">{hint}</div>
      )}
    </div>
  );
}
