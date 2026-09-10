import type { PortfolioAttribution } from "@/domain/attribution";
import { decimal } from "@/domain/decimal";
import { money, percentage, pnlClass } from "@/lib/formatters";
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
  if (!attribution.complete || !attribution.reconciled)
    return (
      <section className="panel p-6">
        <h2 className="text-sm font-medium">შედეგის წყარო</h2>
        <p className="mt-4 text-xs leading-6 text-muted">
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
    <section className="space-y-6" aria-labelledby="attribution-heading">
      <div className="panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="eyebrow">სრული პერიოდი</p>
            <h2 id="attribution-heading" className="mt-2 text-lg font-medium">
              პორტფელის შედეგის წყარო
            </h2>
            <p className="mt-2 max-w-2xl text-xs leading-6 text-muted">
              თანხის შეტანა და გატანა მოგებად ან ზარალად არ ითვლება. აქტივის
              შემოსავლიანობა მის თვითღირებულებას ადარებს; შედეგში წილი კი
              აჩვენებს, რამდენი დოლარი დაამატა აქტივმა მთლიან P&amp;L-ს.
            </p>
          </div>
          <p className={`numeric text-3xl ${pnlClass(attribution.totalPnl)}`}>
            {money(attribution.totalPnl)}
          </p>
        </div>
        <div className="mt-7 grid grid-cols-2 gap-6 lg:grid-cols-5">
          <Metric
            label="ყველაზე დიდი დადებითი წვლილი"
            value={
              attribution.topPositive
                ? `${attribution.topPositive.symbol} · ${money(attribution.topPositive.totalPnl)}`
                : "—"
            }
          />
          <Metric
            label="ყველაზე დიდი უარყოფითი წვლილი"
            value={
              attribution.topNegative
                ? `${attribution.topNegative.symbol} · ${money(attribution.topNegative.totalPnl)}`
                : "—"
            }
          />
          <Metric
            label="უდიდესი სექტორული შედეგი"
            value={
              topCategory
                ? `${categoryLabels[topCategory.category] ?? topCategory.category} · ${money(topCategory.totalPnl)}`
                : "—"
            }
          />
          <Metric
            label="მოგებაში მყოფი აქტივები"
            value={String(attribution.assetsInProfit)}
          />
          <Metric
            label="ზარალში მყოფი აქტივები"
            value={String(attribution.assetsInLoss)}
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <div className="panel overflow-hidden">
          <div className="border-b border-line p-6">
            <h3 className="text-sm font-medium">აქტივების წვლილი</h3>
            <p className="mt-2 text-[11px] leading-5 text-muted">
              დალაგებულია სრული P&amp;L-ის მიხედვით. ზოლი ასახავს დოლარში
              წვლილის სიდიდეს და არა აქტივის შემოსავლიანობას.
            </p>
          </div>
          <div className="divide-y divide-line">
            {attribution.assets.map((row) => {
              const width = denominator
                ? (Math.abs(Number(row.totalPnl)) / denominator) * 100
                : 0;
              return (
                <div key={row.assetId} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium">
                        <span className="mr-2 text-muted">#{row.rank}</span>
                        {row.symbol}
                        <span className="ml-2 text-[10px] font-normal text-muted">
                          {row.name}
                        </span>
                      </p>
                      <p className="mt-2 text-[10px] text-muted">
                        რეალიზებული {money(row.realizedPnl)} · არარეალიზებული{" "}
                        {money(row.unrealizedPnl)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`numeric text-sm ${pnlClass(row.totalPnl)}`}
                      >
                        {money(row.totalPnl)}
                      </p>
                      <p className="mt-1 text-[10px] text-muted">
                        {portfolioLoss && decimal(row.totalPnl!).gt(0)
                          ? `ზარალის შემცირება: ${percentage(decimal(row.contributionPercent!).abs().toString())}`
                          : `${portfolioLoss ? "მთლიან ზარალში წილი" : "მთლიან შედეგში წილი"}: ${percentage(row.contributionPercent)}`}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-raised">
                    <div
                      className={`h-full rounded-full ${decimal(row.totalPnl!).gte(0) ? "bg-positive" : "bg-negative"}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  {!row.isFee && (
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-muted">
                      <span>
                        აქტივის შემოსავლიანობა:{" "}
                        {percentage(row.returnPercent, true)}
                      </span>
                      <span>მიმდინარე წილი: {percentage(row.allocation)}</span>
                      <span>
                        მიმდინარე ღირებულება: {money(row.currentValue)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
            {!attribution.assets.length && (
              <p className="p-8 text-center text-xs text-muted">
                შედეგის გასაანალიზებლად ტრანზაქციები ჯერ არ არის.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {attribution.categories.map((category) => (
            <article key={category.category} className="panel p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xs font-medium">
                    {categoryLabels[category.category] ?? category.category}
                  </h3>
                  <p className="mt-2 text-[10px] text-muted">
                    {category.assets.join(" · ") || "USD ხარჯი"}
                  </p>
                </div>
                <p className={`numeric text-sm ${pnlClass(category.totalPnl)}`}>
                  {money(category.totalPnl)}
                </p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 text-[10px] text-muted">
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
            </article>
          ))}
          <p className="px-1 text-[11px] leading-6 text-muted">
            ისტორიული შემადგენლობა და აქტივის დღიური ფასები ჯერ არ ინახება,
            ამიტომ პერიოდების ღილაკები ზემოთ მხოლოდ შესრულების შეფასებას ცვლის;
            შედეგის წყარო უსაფრთხოდ ნაჩვენებია სრული პერიოდისთვის.
          </p>
        </div>
      </div>
    </section>
  );
}
