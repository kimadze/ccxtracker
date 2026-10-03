"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { PortfolioSummary } from "@/domain/types";
import { decimal } from "@/domain/decimal";
import { portfolioStatistics } from "@/domain/portfolio-statistics";
import { money, percentage, pnlClass } from "@/lib/formatters";
import { BalanceValue } from "./ui";
import { AssetIcon } from "./positions";

export function PortfolioStatistics({
  summary,
  portfolioId,
}: {
  summary: PortfolioSummary;
  portfolioId: string;
}) {
  const data = useMemo(() => portfolioStatistics(summary), [summary]);
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("loss");
  const [search, setSearch] = useState("");
  const attention = (row: (typeof data.rows)[number]) =>
    !row.position.quote ||
    row.position.quote.stale ||
    row.position.value === null ||
    row.position.unrealizedPnl === null ||
    (row.cryptoShare !== null && decimal(row.cryptoShare).gte(25)) ||
    (row.position.returnPercent !== null &&
      decimal(row.position.returnPercent).lte(-50));
  const rows = data.rows
    .filter((row) => {
      const p = row.position;
      return (
        `${p.asset.symbol} ${p.asset.name}`
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase()) &&
        (filter === "all" ||
          (filter === "attention" && attention(row)) ||
          (filter === "profit" &&
            p.unrealizedPnl !== null &&
            decimal(p.unrealizedPnl).gt(0)) ||
          (filter === "loss" &&
            p.unrealizedPnl !== null &&
            decimal(p.unrealizedPnl).lt(0)))
      );
    })
    .sort((a, b) => {
      const value = (row: typeof a) =>
        sort === "value"
          ? row.position.value
          : sort === "day"
            ? row.dayImpact
            : row.position.unrealizedPnl;
      const av = value(a),
        bv = value(b);
      if (av === null) return bv === null ? 0 : 1;
      if (bv === null) return -1;
      return decimal(av).cmp(bv) * (sort === "loss" ? 1 : -1);
    });
  const sources = [...data.rows]
    .filter((row) => row.position.unrealizedPnl !== null)
    .sort((a, b) =>
      decimal(b.position.unrealizedPnl!).cmp(a.position.unrealizedPnl!),
    );
  const gain = sources.find((row) =>
    decimal(row.position.unrealizedPnl!).gt(0),
  );
  const loss = [...sources]
    .reverse()
    .find((row) => decimal(row.position.unrealizedPnl!).lt(0));
  return (
    <div className="space-y-3">
      <section
        className="grid grid-cols-2 gap-3 lg:grid-cols-3"
        aria-label="პორტფელის შედეგის წყაროები"
      >
        {[
          { label: "დღის საბაზრო გავლენა", value: data.impact, symbol: null },
          {
            label: "მოგების მთავარი წყარო",
            value: gain?.position.unrealizedPnl ?? null,
            symbol: gain?.position.asset.symbol,
          },
          {
            label: "ზარალის მთავარი წყარო",
            value: loss?.position.unrealizedPnl ?? null,
            symbol: loss?.position.asset.symbol,
          },
        ].map((metric) => (
          <div
            className={`card card-border bg-base-200 ${metric.label === "დღის საბაზრო გავლენა" ? "col-span-2 lg:col-span-1" : ""}`}
            key={metric.label}
          >
            <div className="stat min-w-0 p-3">
              <div className="stat-title whitespace-normal text-xs">
                {metric.label}
              </div>
              <div
                className={`stat-value mt-1 overflow-x-auto whitespace-nowrap text-xl ${pnlClass(metric.value)}`}
              >
                <BalanceValue>{money(metric.value)}</BalanceValue>
              </div>
              <div className="stat-desc mt-1">
                {metric.symbol ??
                  (metric.label === "დღის საბაზრო გავლენა"
                    ? `ფასების დაფარვა ${data.covered}/${data.total}`
                    : "—")}
              </div>
            </div>
          </div>
        ))}
      </section>
      <details className="collapse collapse-arrow border border-base-300 bg-base-200">
        <summary className="collapse-title min-h-11 py-3 text-xs">
          როგორ იკითხება ეს მონაცემები
        </summary>
        <div className="collapse-content space-y-2 text-xs text-base-content/65">
          <p>
            დღის გავლენა: 24-საათიანი ფასის ცვლილება მიმდინარე რაოდენობაზე. დღის
            განმავლობაში შესყიდვა/გაყიდვას არ ითვალისწინებს და რეალური დღიური
            P/L არ არის. არასრული ან მოძველებული ფასებისას ჯამი არ გამოითვლება.
          </p>
          <p>
            შედეგის წყაროები და ცხრილის P/L არის მიმდინარე კრიპტოპოზიციების
            არარეალიზებული შედეგი; ქეში, სტეიბლკოინები და დახურული პოზიციები არ
            შედის.
          </p>
          <p>
            აღდგენა: საშუალო შესყიდვის ფასამდე საჭირო ზრდა. „ყურადღება“
            აღნიშნავს კრიპტოაქტივების ≥25% წილს, ≥50% ზარალს ან
            არასრულ/მოძველებულ მონაცემებს. ეს საინფორმაციო ფილტრია.
          </p>
        </div>
      </details>
      <section className="card card-border min-w-0 bg-base-200">
        <div className="card-body gap-3 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">პოზიციების შედეგები</h2>
            <Link
              href={`/portfolios/${portfolioId}/analytics`}
              className="btn btn-ghost text-xs"
            >
              ანალიტიკა ↗
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              className="input min-w-0 flex-1"
              aria-label="სტატისტიკის აქტივის ძიება"
              placeholder="აქტივი ან სიმბოლო"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="select w-full sm:w-auto"
              aria-label="სტატისტიკის დალაგება"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="loss">ზარალის წყაროები</option>
              <option value="profit">მოგების წყაროები</option>
              <option value="day">დღის გავლენა</option>
              <option value="value">ღირებულება</option>
            </select>
          </div>
          <div
            className="flex flex-wrap gap-1"
            role="group"
            aria-label="პოზიციების შედეგის ფილტრი"
          >
            {[
              ["all", "ყველა"],
              [
                "attention",
                `ყურადღება · ${data.rows.filter(attention).length}`,
              ],
              ["profit", "მოგებაში"],
              ["loss", "ზარალში"],
            ].map(([value, label]) => (
              <button
                type="button"
                className={`btn px-2 text-xs ${filter === value ? "btn-soft btn-primary" : "btn-ghost"}`}
                key={value}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <ul className="list lg:hidden">
            {rows.map((row) => (
              <li
                key={row.position.assetId}
                className="border-b border-base-300 last:border-0"
              >
                <Link
                  href={`/portfolios/${portfolioId}/positions/${row.position.assetId}`}
                  className="block rounded-field p-3 hover:bg-base-300/40"
                >
                  <div className="flex items-center gap-2">
                    <AssetIcon
                      symbol={row.position.asset.symbol}
                      logoUrl={row.position.asset.logoUrl}
                      size={32}
                    />
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate">
                        {row.position.asset.symbol}
                      </strong>
                      <span
                        className="block truncate text-xs text-base-content/55"
                        title={row.position.asset.name}
                      >
                        {row.position.asset.name}
                      </span>
                    </span>
                    <span
                      className={`max-w-[55%] overflow-x-auto whitespace-nowrap text-right ${pnlClass(row.position.unrealizedPnl)}`}
                    >
                      <BalanceValue>
                        {money(row.position.unrealizedPnl)}
                      </BalanceValue>
                      <span className="block text-xs">
                        {percentage(row.position.returnPercent, true)}
                      </span>
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    {[
                      [
                        "ღირებულება",
                        <BalanceValue key="v">
                          {money(row.position.value)}
                        </BalanceValue>,
                      ],
                      ["კრიპტოს წილი", percentage(row.cryptoShare)],
                      [
                        "დღის გავლენა",
                        <BalanceValue key="d">
                          {money(row.dayImpact)}
                        </BalanceValue>,
                      ],
                      ["აღდგენა", percentage(row.recovery)],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="min-w-0">
                        <dt className="text-base-content/55">{label}</dt>
                        <dd className="mt-1 overflow-x-auto whitespace-nowrap tabular-nums">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {attention(row) && (
                    <p className="mt-2 text-xs text-warning">
                      {!row.position.quote || row.position.value === null
                        ? "ფასი მიუწვდომელია"
                        : row.position.quote.stale
                          ? "ფასი მოძველებულია"
                          : row.position.unrealizedPnl === null
                            ? "შესყიდვის მონაცემები არასრულია"
                            : "ყურადღების ფილტრი"}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto lg:block">
            <table className="table table-sm">
              <thead>
                <tr>
                  {[
                    "აქტივი",
                    "ღირებულება",
                    "კრიპტოს წილი",
                    "P/L",
                    "დღის გავლენა",
                    "აღდგენა",
                  ].map((label, i) => (
                    <th key={label} className={i ? "text-right" : ""}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.position.assetId}>
                    <td>
                      <Link
                        className="flex min-h-11 items-center gap-2"
                        href={`/portfolios/${portfolioId}/positions/${row.position.assetId}`}
                      >
                        <AssetIcon
                          symbol={row.position.asset.symbol}
                          logoUrl={row.position.asset.logoUrl}
                          size={32}
                        />
                        <span className="min-w-0">
                          <strong>{row.position.asset.symbol}</strong>
                          <span
                            className="block max-w-32 truncate text-xs text-base-content/55"
                            title={row.position.asset.name}
                          >
                            {row.position.asset.name}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <BalanceValue>{money(row.position.value)}</BalanceValue>
                    </td>
                    <td className="whitespace-nowrap text-right">
                      {percentage(row.cryptoShare)}
                    </td>
                    <td
                      className={`whitespace-nowrap text-right ${pnlClass(row.position.unrealizedPnl)}`}
                    >
                      <BalanceValue>
                        {money(row.position.unrealizedPnl)}
                      </BalanceValue>
                      <small className="block">
                        {percentage(row.position.returnPercent, true)}
                      </small>
                    </td>
                    <td
                      className={`whitespace-nowrap text-right ${pnlClass(row.dayImpact)}`}
                    >
                      <BalanceValue>{money(row.dayImpact)}</BalanceValue>
                    </td>
                    <td className="whitespace-nowrap text-right">
                      {percentage(row.recovery)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && (
            <p className="py-3 text-sm text-base-content/60">
              {data.total
                ? "ამ ფილტრით პოზიციები არ მოიძებნა."
                : "აქტიური პოზიცია არ არის."}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
