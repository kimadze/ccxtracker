import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Layers3 } from "lucide-react";
import type { ValuedPosition } from "@/domain/types";
import { money, percentage, quantity, pnlClass } from "@/lib/formatters";
import { BalanceValue } from "./ui";

const colors = [
  "var(--accent)",
  "var(--violet)",
  "var(--teal)",
  "var(--orange)",
  "var(--blue)",
  "var(--grey)",
];
export function AssetIcon({
  symbol,
  logoUrl,
  index = 0,
}: {
  symbol: string;
  logoUrl?: string | null;
  index?: number;
}) {
  return (
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold"
      style={{
        color: colors[index % colors.length],
        borderColor: `color-mix(in srgb, ${colors[index % colors.length]} 25%, transparent)`,
        background: `color-mix(in srgb, ${colors[index % colors.length]} 12%, transparent)`,
      }}
    >
      {logoUrl ? <Image unoptimized src={logoUrl} alt="" width={36} height={36} className="size-full rounded-full object-cover" /> : symbol.slice(0, 3)}
    </span>
  );
}
export function PositionsTable({
  positions,
  base,
  preview = false,
}: {
  positions: ValuedPosition[];
  base: string;
  preview?: boolean;
}) {
  if (!positions.length)
    return (
      <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center">
        <span className="mb-4 rounded-xl border border-line bg-raised p-3 text-brand">
          <Layers3 size={22} />
        </span>
        <h3 className="text-sm font-medium">
          პოზიციები ჯერ არ არის დამატებული
        </h3>
        <p className="mt-2 max-w-sm text-xs leading-6 text-muted">
          დაამატეთ არსებული აქტივი ან ჩაიწერეთ პირველი შესყიდვა. ყველა
          მაჩვენებელი ავტომატურად გამოითვლება.
        </p>
      </div>
    );
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full">
          <thead className="bg-raised/35">
            <tr>
              {[
                "აქტივი",
                "რაოდენობა",
                "საშუალო ფასი",
                "მიმდინარე ფასი",
                "ღირებულება",
                "მოგება / ზარალი",
                "წილი",
              ].map((h, i) => (
                <th
                  key={h}
                  className={`table-head ${i === 0 ? "text-left! pl-6!" : ""}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map((p, i) => (
              <tr key={p.assetId} className="transition-colors hover:bg-raised/55">
                <td className="table-cell pl-6! text-left!">
                  <div className="flex items-center gap-3">
                    <AssetIcon symbol={p.asset.symbol} logoUrl={p.asset.logoUrl} index={i} />
                    <div>
                      {preview ? (
                        <span className="text-xs font-medium">
                          {p.asset.name}
                        </span>
                      ) : (
                        <Link
                          className="text-xs font-medium hover:text-brand"
                          href={`${base}/positions/${p.assetId}`}
                        >
                          {p.asset.name}
                        </Link>
                      )}
                      <p className="mt-1 text-[10px] text-muted">
                        {p.asset.symbol}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="table-cell numeric text-xs">
                  {quantity(p.quantity)}
                </td>
                <td className="table-cell numeric text-xs text-muted">
                  {money(p.averagePrice)}
                </td>
                <td className="table-cell">
                  <div className="numeric text-xs">
                    {money(p.quote?.price ?? null)}
                  </div>
                  <div
                    className={`mt-1 text-[10px] ${pnlClass(p.quote?.change24h ?? null)}`}
                  >
                    {percentage(p.quote?.change24h ?? null, true)}
                  </div>
                </td>
                <td className="table-cell numeric text-sm font-medium">
                  <BalanceValue>{money(p.value)}</BalanceValue>
                </td>
                <td className={`table-cell ${pnlClass(p.unrealizedPnl)}`}>
                  <div className="numeric text-xs">
                    <BalanceValue>{p.unrealizedPnl && Number(p.unrealizedPnl) > 0 ? "+" : ""}{money(p.unrealizedPnl)}</BalanceValue>
                  </div>
                  <div className="mt-1 text-[10px]">
                    {percentage(p.returnPercent, true)}
                  </div>
                </td>
                <td className="table-cell text-xs">
                  <div>{percentage(p.allocation)}</div>
                  <div className="ml-auto mt-2 h-1 w-12 rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{
                        width: `${Math.min(Number(p.allocation ?? 0), 100)}%`,
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="dashboard-position-cards md:hidden">
        {positions.map((p, i) => (
          <div key={p.assetId} className="dashboard-position-card">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <AssetIcon symbol={p.asset.symbol} logoUrl={p.asset.logoUrl} index={i} />
                <div>
                  <p className="text-sm font-medium">{p.asset.symbol}</p>
                  <p className="mt-1 text-xs text-muted">{p.asset.name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="numeric font-medium"><BalanceValue>{money(p.value)}</BalanceValue></p>
                <p className="mt-1 text-xs text-muted">პორტფელის {percentage(p.allocation)}</p>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 text-xs">
              <div><dt className="text-muted">რაოდენობა</dt><dd className="numeric mt-1">{quantity(p.quantity)}</dd></div>
              <div><dt className="text-muted">საშუალო ფასი</dt><dd className="numeric mt-1">{money(p.averagePrice)}</dd></div>
              <div><dt className="text-muted">მიმდინარე ფასი</dt><dd className="numeric mt-1">{money(p.quote?.price ?? null)}</dd></div>
              <div><dt className="text-muted">24 საათი</dt><dd className={`numeric mt-1 ${pnlClass(p.quote?.change24h ?? null)}`}>{percentage(p.quote?.change24h ?? null, true)}</dd></div>
              <div className="col-span-2"><dt className="text-muted">არარეალიზებული P/L</dt><dd className={`numeric mt-1 ${pnlClass(p.unrealizedPnl)}`}><BalanceValue>{money(p.unrealizedPnl)}</BalanceValue> · {percentage(p.returnPercent, true)}</dd></div>
            </dl>
            <div className="mt-4 flex justify-end text-xs text-muted">
              {!preview && (
                <Link
                  href={`${base}/positions/${p.assetId}`}
                  className="button-secondary"
                >
                  დეტალები <ArrowUpRight size={14} />
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
