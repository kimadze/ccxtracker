"use client";
import { useState } from "react";
import type { PortfolioAttribution } from "@/domain/attribution";
import { decimal } from "@/domain/decimal";
import { money, percentage, pnlClass } from "@/lib/formatters";
import { BalanceValue } from "./ui";
import { Metric } from "./overview";

const categoryLabels: Record<string, string> = {
  "store-of-value": "ღირებულების საცავი",
  "layer-1": "Layer 1",
  infrastructure: "ინფრასტრუქტურა",
  stablecoin: "სტეიბლკოინები",
  fees: "საკომისიოები",
  other: "სხვა",
};

export function PerformanceAttribution({
  attribution,
}: {
  attribution: PortfolioAttribution;
}) {
  const [showAllAssets, setShowAllAssets] = useState(false);
  if (!attribution.complete || !attribution.reconciled)
    return (
      <section className="card card-border bg-base-200 p-4">
        <h2 className="text-sm font-medium">შედეგის წყარო</h2>
        <p className="mt-2 text-xs leading-6 text-base-content/60">
          სრული ანალიზისთვის საჭიროა ყველა აქტივის მიმდინარე ფასი და ცნობილი
          თვითღირებულება. არასრული მონაცემებით შედეგის განაწილება არ გამოჩნდება,
          რადგან მისი პორტფელის P&amp;L-თან შეჯერება შეუძლებელია.
        </p>
      </section>
    );

  const denominator = attribution.assets.reduce(
    (largest, row) => Math.max(largest, Math.abs(Number(row.totalPnl ?? "0"))),
    0,
  );
  const portfolioLoss = decimal(attribution.totalPnl!).lt(0);
  const topCategory = [...attribution.categories]
    .filter((category) => category.totalPnl !== null)
    .sort((a, b) => decimal(b.totalPnl!).cmp(a.totalPnl!))[0];
  return (
    <section
      className="space-y-3 lg:space-y-4"
      aria-labelledby="attribution-heading"
    >
      <div className="card card-border bg-base-200 p-4">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              სრული პერიოდი
            </p>
            <h2 id="attribution-heading" className="mt-1 text-sm font-medium">
              პორტფელის შედეგის წყარო
            </h2>
            <p className="sr-only">
              თანხის შეტანა და გატანა მოგებად ან ზარალად არ ითვლება. აქტივის
              შემოსავლიანობა მის თვითღირებულებას ადარებს; შედეგში წილი კი
              აჩვენებს, რამდენი დოლარი დაამატა აქტივმა მთლიან P&amp;L-ს.
            </p>
          </div>
          <p className={`numeric text-2xl ${pnlClass(attribution.totalPnl)}`}>
            <BalanceValue>{money(attribution.totalPnl)}</BalanceValue>
          </p>
        </div>
        <details className="collapse collapse-arrow mt-3 bg-base-100">
          <summary className="collapse-title min-h-11 py-3 text-xs">
            დამატებითი მაჩვენებლები
          </summary>
          <div className="collapse-content grid grid-cols-2 gap-3 xl:grid-cols-3">
            <p className="col-span-2 text-xs leading-5 text-base-content/60 xl:col-span-3">
              თანხის შეტანა და გატანა P/L-ში არ ითვლება. აქტივის შემოსავლიანობა
              თვითღირებულებას ადარებს; წვლილი — მთლიან შედეგს.
            </p>
            <Metric
              label="ყველაზე დიდი დადებითი წვლილი"
              value={
                attribution.topPositive
                  ? `${attribution.topPositive.symbol} · ${money(attribution.topPositive.totalPnl)}`
                  : "—"
              }
              sensitive
            />
            <Metric
              label="ყველაზე დიდი უარყოფითი წვლილი"
              value={
                attribution.topNegative
                  ? `${attribution.topNegative.symbol} · ${money(attribution.topNegative.totalPnl)}`
                  : "—"
              }
              sensitive
            />
            <Metric
              label="უდიდესი სექტორული შედეგი"
              value={
                topCategory && attribution.categories.length > 1
                  ? `${categoryLabels[topCategory.category] ?? topCategory.category} · ${money(topCategory.totalPnl)}`
                  : "—"
              }
              sensitive
            />
            <Metric
              label="მოგებაში მყოფი აქტივები"
              value={String(attribution.assetsInProfit)}
            />
            <Metric
              label="ხარჯში მყოფი აქტივები"
              value={String(attribution.assetsInLoss)}
            />
          </div>
        </details>
      </div>

      <div className="grid gap-3 lg:gap-4 xl:grid-cols-[1.45fr_1fr]">
        <div className="card card-border overflow-hidden bg-base-200">
          <div className="border-b border-base-300 p-3">
            <h3 className="text-sm font-medium">აქტივების წვლილი</h3>
            <p className="sr-only">
              დალაგებულია სრული P&amp;L-ის მიხედვით. ზოლი ასახავს დოლარში
              წვლილის სიდიდეს და არა აქტივის შემოსავლიანობას.
            </p>
          </div>
          <div className="divide-y divide-base-300">
            {(showAllAssets
              ? attribution.assets
              : attribution.assets.slice(0, 6)
            ).map((row) => {
              const width = denominator
                ? (Math.abs(Number(row.totalPnl)) / denominator) * 100
                : 0;
              return (
                <details
                  key={row.assetId}
                  className="collapse collapse-arrow rounded-none"
                >
                  <summary className="collapse-title min-h-11 p-3 pr-10">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0 text-xs">
                        <strong>
                          <span className="mr-2 text-base-content/50">
                            #{row.rank}
                          </span>
                          {row.symbol}
                        </strong>
                        <span className="mt-1 block truncate text-base-content/60">
                          {row.name}
                        </span>
                      </div>
                      <div className="shrink-0 whitespace-nowrap text-right tabular-nums">
                        <strong className={`text-sm ${pnlClass(row.totalPnl)}`}>
                          <BalanceValue>{money(row.totalPnl)}</BalanceValue>
                        </strong>
                        <span
                          title={portfolioLoss && decimal(row.totalPnl!).gt(0) ? "ზარალის შემცირება" : "მთლიან შედეგში წილი"}
                          className="mt-1 block text-xs text-base-content/60"
                        >
                          {portfolioLoss && decimal(row.totalPnl!).gt(0)
                            ? `${percentage(decimal(row.contributionPercent!).abs().toString())} ზარალის შემცირება`
                            : percentage(row.contributionPercent)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-base-300">
                      <div
                        className={`h-full ${decimal(row.totalPnl!).gte(0) ? "bg-success" : "bg-error"}`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </summary>
                  <div className="collapse-content grid grid-cols-2 gap-2 text-xs text-base-content/60">
                    <p className="col-span-2">
                      ზოლი ასახავს დოლარში წვლილს, არა შემოსავლიანობას.
                    </p>
                    <span>
                      რეალიზებული{" "}
                      <BalanceValue>{money(row.realizedPnl)}</BalanceValue>
                    </span>
                    <span>
                      არარეალიზებული{" "}
                      <BalanceValue>{money(row.unrealizedPnl)}</BalanceValue>
                    </span>
                    {portfolioLoss && decimal(row.totalPnl!).gt(0) && (
                      <span className="col-span-2">დადებითი წვლილი ამცირებს მთლიან ზარალს.</span>
                    )}
                    {!row.isFee && (
                      <>
                        <span>
                          შემოსავლიანობა {percentage(row.returnPercent, true)}
                        </span>
                        <span>მიმდინარე წილი {percentage(row.allocation)}</span>
                        <span className="col-span-2">
                          ღირებულება{" "}
                          <BalanceValue>{money(row.currentValue)}</BalanceValue>
                        </span>
                      </>
                    )}
                  </div>
                </details>
              );
            })}
            {attribution.assets.length > 6 && (
              <button
                type="button"
                className="btn btn-block rounded-none"
                onClick={() => setShowAllAssets((open) => !open)}
              >
                {showAllAssets
                  ? "ნაკლების ნახვა"
                  : `ყველა ${attribution.assets.length} აქტივის ნახვა`}
              </button>
            )}
            {!attribution.assets.length && (
              <p className="p-8 text-center text-xs text-base-content/60">
                შედეგის გასაანალიზებლად ტრანზაქციები ჯერ არ არის.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {attribution.categories.length > 1 && attribution.categories.map((category) => (
            <article
              key={category.category}
              className="card card-border bg-base-200 p-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xs font-medium">
                    {categoryLabels[category.category] ?? category.category}
                  </h3>
                  <p className="mt-2 text-xs text-base-content/60">
                    {category.assets.join(" · ") || "USD ხარჯი"}
                  </p>
                </div>
                <p className={`numeric text-sm ${pnlClass(category.totalPnl)}`}>
                  <BalanceValue>{money(category.totalPnl)}</BalanceValue>
                </p>
              </div>
              <details className="collapse collapse-arrow mt-2 bg-base-100">
                <summary className="collapse-title min-h-11 py-3 text-xs">
                  დეტალები
                </summary>
                <div className="collapse-content grid grid-cols-2 gap-2 text-xs text-base-content/60">
                  <span>
                    პორტფელის მიმდინარე წილი: {percentage(category.allocation)}
                  </span>
                  <span>
                    შედეგში წილი: {percentage(category.contributionPercent)}
                  </span>
                  <span>
                    დადებითი ლიდერი: {category.largestPositive?.symbol ?? "—"}
                  </span>
                  <span>
                    უარყოფითი ლიდერი: {category.largestNegative?.symbol ?? "—"}
                  </span>
                </div>
              </details>
            </article>
          ))}
          <p className="px-1 text-xs leading-5 text-base-content/60">
            ისტორიული შემადგენლობა და აქტივის დღიური ფასები ჯერ არ ინახება,
            ამიტომ პერიოდების ღილაკები ზემოთ მხოლოდ შესრულების შეფასებას ცვლის;
            შედეგის წყარო უსაფრთხოდ ნაჩვენებია სრული პერიოდისთვის.
          </p>
        </div>
      </div>
    </section>
  );
}
