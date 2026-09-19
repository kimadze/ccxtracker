import type { Asset, LedgerEntry, PortfolioSummary } from "@/domain/types";
import { amount, decimal } from "@/domain/decimal";
import { dateTime, money, pnlClass, quantity } from "@/lib/formatters";
import { TransactionForm } from "./transaction-form";
import { AssetIcon } from "./positions";

export function AirdropWorkspace({
  entries,
  assets,
  summary,
  portfolioId,
  revision,
  preview = false,
}: {
  entries: LedgerEntry[];
  assets: Asset[];
  summary: PortfolioSummary;
  portfolioId: string;
  revision: number;
  preview?: boolean;
}) {
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const positionByAsset = new Map(summary.positions.map((position) => [position.assetId, position]));
  const rows = entries
    .filter((entry) => entry.kind === "airdrop")
    .map((entry) => {
      const position = positionByAsset.get(entry.assetId);
      const receivedValue = entry.price ? amount(decimal(entry.quantity).mul(entry.price)) : null;
      const estimatedValue = position?.quote
        ? amount(decimal(entry.quantity).mul(position.quote.price))
        : null;
      const movement = receivedValue !== null && estimatedValue !== null
        ? amount(decimal(estimatedValue).minus(receivedValue))
        : null;
      return { entry, asset: assetById.get(entry.assetId), receivedValue, estimatedValue, movement };
    })
    .sort((a, b) => Date.parse(b.entry.occurredAt) - Date.parse(a.entry.occurredAt));
  const received = amount(rows.reduce((total, row) => total.plus(row.receivedValue ?? 0), decimal(0)));
  const estimated = rows.some((row) => row.estimatedValue === null)
    ? null
    : amount(rows.reduce((total, row) => total.plus(row.estimatedValue!), decimal(0)));
  const movement = estimated === null ? null : amount(decimal(estimated).minus(received));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="მიღებული Airdrop-ები" value={String(rows.length)} hint="ყველა მიღება" />
        <Metric label="ღირებულება მიღებისას" value={money(received)} hint="საწყისი თვითღირებულება" />
        <Metric label="დღევანდელი სავარაუდო ღირებულება" value={money(estimated)} hint="მიღებული რაოდენობის მიხედვით" />
        <Metric label="ფასის ცვლილება" value={movement === null ? "—" : `${Number(movement) > 0 ? "+" : ""}${money(movement)}`} tone={pnlClass(movement)} hint="გაყიდვების გარეშე შეფასება" />
      </div>
      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">Airdrop ისტორია</h2>
            <p className="mt-1 text-[11px] leading-5 text-muted">მიღების ფასი ინახება თვითღირებულებად; გაყიდვები ჩვეულებრივ ტრანზაქციებში აისახება.</p>
          </div>
          <span className="rounded-md bg-raised px-2 py-1 text-[10px] text-muted">{rows.length} ჩანაწერი</span>
        </div>
        {!rows.length ? (
          <div className="px-5 py-16 text-center">
            <p className="text-sm font-medium">Airdrop ჯერ არ გაქვთ დამატებული.</p>
            <p className="mt-2 text-xs text-muted">დაამატეთ მიღებული აქტივი, მიღების ფასი და წყარო.</p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {rows.map(({ entry, asset, receivedValue, movement }) => (
              <div key={entry.id} className="flex flex-wrap items-center justify-between gap-5 px-5 py-4 hover:bg-raised/35">
                <div className="min-w-48">
                  <div className="flex items-center gap-2">
                    <AssetIcon symbol={asset?.symbol ?? "?"} logoUrl={asset?.logoUrl} />
                    <div><p className="text-xs font-semibold">{asset?.symbol ?? entry.assetId}</p><p className="text-[10px] text-muted">{entry.airdropSource || "წყარო მითითებული არ არის"}{entry.airdropNetwork ? ` · ${entry.airdropNetwork}` : ""}</p></div>
                  </div>
                  <p className="mt-2 text-[10px] text-muted">{dateTime(entry.occurredAt, true)} · {entry.airdropStatus === "locked" ? "დაბლოკილი" : "მიღებული"}</p>
                </div>
                <div className="grid grid-cols-2 gap-x-7 gap-y-2 text-right sm:grid-cols-4">
                  <Data label="რაოდენობა" value={quantity(entry.quantity)} />
                  <Data label="მიღების ფასი" value={money(entry.price)} />
                  <Data label="საწყისი ღირებულება" value={money(receivedValue)} />
                  <Data label="ფასის ცვლილება" value={movement === null ? "—" : `${Number(movement) > 0 ? "+" : ""}${money(movement)}`} tone={pnlClass(movement)} />
                </div>
                {!preview && <TransactionForm portfolioId={portfolioId} revision={revision} assets={assets} entry={entry} />}
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="text-[10px] leading-5 text-muted">„დღევანდელი სავარაუდო ღირებულება“ ითვლის მიღებულ მთლიან რაოდენობას მიმდინარე საბაზრო ფასით. თუ აქტივი ნაწილობრივ ან სრულად გაყიდეთ, რეალიზებული შედეგი პორტფელის ანალიტიკაში აისახება.</p>
    </div>
  );
}

function Metric({ label, value, hint, tone = "text-foreground" }: { label: string; value: string; hint: string; tone?: string }) {
  return <div className="panel p-5"><p className="text-[11px] text-muted">{label}</p><p className={`numeric mt-2 text-xl font-semibold ${tone}`}>{value}</p><p className="mt-2 text-[10px] text-muted">{hint}</p></div>;
}
function Data({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return <div><p className="text-[9px] text-muted">{label}</p><p className={`numeric mt-1 text-xs font-medium ${tone}`}>{value}</p></div>;
}
