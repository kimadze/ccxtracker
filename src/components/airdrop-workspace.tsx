"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { Asset, LedgerEntry, PortfolioSummary } from "@/domain/types";
import { amount, decimal } from "@/domain/decimal";
import { dateTime, money, pnlClass, quantity } from "@/lib/formatters";
import { TransactionForm } from "./transaction-form";
import { deleteTransaction } from "@/server/actions";
import { Message, Modal } from "./ui";
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
    <div className="space-y-5">
      <div className="stats stats-vertical w-full border border-base-300 bg-base-200 shadow-sm lg:stats-horizontal">
        <Metric label="მიღებული Airdrop-ები" value={String(rows.length)} hint="ყველა მიღება" />
        <Metric label="ღირებულება მიღებისას" value={money(received)} hint="საწყისი თვითღირებულება" />
        <Metric label="დღევანდელი სავარაუდო ღირებულება" value={money(estimated)} hint="მიღებული რაოდენობის მიხედვით" />
        <Metric label="ფასის ცვლილება" value={movement === null ? "—" : `${Number(movement) > 0 ? "+" : ""}${money(movement)}`} tone={pnlClass(movement)} hint="გაყიდვების გარეშე შეფასება" />
      </div>
      <section className="card card-border overflow-hidden bg-base-200">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-base-300 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">Airdrop ისტორია</h2>
            <p className="mt-1 text-xs leading-5 text-base-content/60">მიღების ფასი ინახება თვითღირებულებად; გაყიდვები ჩვეულებრივ ტრანზაქციებში აისახება.</p>
          </div>
          <span className="badge">{rows.length} ჩანაწერი</span>
        </div>
        {!rows.length ? (
          <div className="px-5 py-9 text-center">
            <p className="text-sm font-medium">Airdrop ჯერ არ გაქვთ დამატებული.</p>
            <p className="mt-2 text-xs text-base-content/60">დაამატეთ მიღებული აქტივი, მიღების ფასი და წყარო.</p>
          </div>
        ) : (
          <ul className="list">
            {rows.map(({ entry, asset, receivedValue, movement }) => (
              <li key={entry.id} className="list-row border-b border-base-300 last:border-0">
                <div className="min-w-48">
                  <div className="flex items-center gap-2">
                    <AssetIcon symbol={asset?.symbol ?? "?"} logoUrl={asset?.logoUrl} />
                    <div><p className="text-xs font-semibold">{asset?.symbol ?? entry.assetId}</p><p className="text-xs text-base-content/60">{entry.airdropSource || "წყარო მითითებული არ არის"}{entry.airdropNetwork ? ` · ${entry.airdropNetwork}` : ""}</p></div>
                  </div>
                  <p className="mt-2 text-xs text-base-content/60">{dateTime(entry.occurredAt, true)} · {entry.airdropStatus === "locked" ? "დაბლოკილი" : "მიღებული"}</p>
                </div>
                <div className="grid grid-cols-2 gap-x-7 gap-y-2 text-right sm:grid-cols-4">
                  <Data label="რაოდენობა" value={quantity(entry.quantity)} />
                  <Data label="მიღების ფასი" value={money(entry.price)} />
                  <Data label="საწყისი ღირებულება" value={money(receivedValue)} />
                  <Data label="ფასის ცვლილება" value={movement === null ? "—" : `${Number(movement) > 0 ? "+" : ""}${money(movement)}`} tone={pnlClass(movement)} />
                </div>
                {!preview && <div><AirdropActions portfolioId={portfolioId} revision={revision} assets={assets} entry={entry} /></div>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <div role="alert" className="alert alert-info alert-soft text-xs leading-5">„დღევანდელი სავარაუდო ღირებულება“ ითვლის მიღებულ მთლიან რაოდენობას მიმდინარე საბაზრო ფასით. თუ აქტივი ნაწილობრივ ან სრულად გაყიდეთ, რეალიზებული შედეგი პორტფელის ანალიტიკაში აისახება.</div>
    </div>
  );
}

function Metric({ label, value, hint, tone = "text-foreground" }: { label: string; value: string; hint: string; tone?: string }) {
  return <div className="stat"><p className="stat-title whitespace-normal text-xs">{label}</p><p className={`stat-value numeric mt-2 whitespace-normal text-xl ${tone}`}>{value}</p><p className="stat-desc mt-2 whitespace-normal text-xs">{hint}</p></div>;
}
function Data({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return <div><p className="text-xs text-base-content/50">{label}</p><p className={`numeric mt-1 text-xs font-medium ${tone}`}>{value}</p></div>;
}

function AirdropActions({ portfolioId, revision, assets, entry }: { portfolioId: string; revision: number; assets: Asset[]; entry: LedgerEntry }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  return <><div className="flex gap-1"><TransactionForm portfolioId={portfolioId} revision={revision} assets={assets} entry={entry} triggerLabel="რედაქტირება" /><button className="btn btn-ghost btn-square btn-sm text-error" type="button" aria-label="Airdrop-ის წაშლა" onClick={() => { setConfirming(true); setError(""); }}><Trash2 size={15} /></button></div><Modal open={confirming} onOpenChange={(open) => { if (!open && !pending) setConfirming(false); }} title="Airdrop-ის წაშლა" description="ჩანაწერი წაიშლება და პორტფელის ისტორია თავიდან გამოითვლება."><div className="space-y-5">{error && <Message error>{error}</Message>}<div className="flex justify-end gap-3"><button className="btn" disabled={pending} onClick={() => setConfirming(false)}>გაუქმება</button><button className="btn btn-error" disabled={pending} onClick={async () => { setPending(true); try { const result = await deleteTransaction(portfolioId, entry.id, revision); if (result.ok) { setConfirming(false); router.refresh(); } else setError(result.error); } catch { setError("წაშლა ვერ მოხერხდა."); } finally { setPending(false); } }}>{pending ? "იშლება…" : "წაშლა"}</button></div></div></Modal></>;
}
