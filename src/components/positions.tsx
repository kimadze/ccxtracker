import Link from "next/link";
import { ArrowUpRight, Layers3 } from "lucide-react";
import type { ValuedPosition } from "@/domain/types";
import { money, percentage, quantity, pnlClass } from "@/lib/formatters";

const colors = [
  "#c4a875",
  "#aaa2df",
  "#89c6bd",
  "#aa91ff",
  "#8eabc9",
  "#cf9fb9",
];
export function AssetIcon({
  symbol,
  index = 0,
}: {
  symbol: string;
  index?: number;
}) {
  return (
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold"
      style={{
        color: colors[index % colors.length],
        borderColor: `${colors[index % colors.length]}30`,
        background: `${colors[index % colors.length]}12`,
      }}
    >
      {symbol.slice(0, 3)}
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
          <thead>
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
              <tr key={p.assetId} className="hover:bg-white/2">
                <td className="table-cell pl-6! text-left!">
                  <div className="flex items-center gap-3">
                    <AssetIcon symbol={p.asset.symbol} index={i} />
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
                  {money(p.value)}
                </td>
                <td className={`table-cell ${pnlClass(p.unrealizedPnl)}`}>
                  <div className="numeric text-xs">
                    {p.unrealizedPnl && Number(p.unrealizedPnl) > 0 ? "+" : ""}
                    {money(p.unrealizedPnl)}
                  </div>
                  <div className="mt-1 text-[10px]">
                    {percentage(p.returnPercent, true)}
                  </div>
                </td>
                <td className="table-cell text-xs">
                  <div>{percentage(p.allocation)}</div>
                  <div className="ml-auto mt-2 h-1 w-12 rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-brand/60"
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
      <div className="divide-y divide-line md:hidden">
        {positions.map((p, i) => (
          <div key={p.assetId} className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <AssetIcon symbol={p.asset.symbol} index={i} />
                <div>
                  <p className="text-sm font-medium">{p.asset.symbol}</p>
                  <p className="mt-1 text-xs text-muted">
                    {quantity(p.quantity)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="numeric font-medium">{money(p.value)}</p>
                <p className={`mt-1 text-xs ${pnlClass(p.unrealizedPnl)}`}>
                  {money(p.unrealizedPnl)} · {percentage(p.returnPercent, true)}
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-between text-[11px] text-muted">
              <span>წილი: {percentage(p.allocation)}</span>
              {!preview && (
                <Link
                  href={`${base}/positions/${p.assetId}`}
                  className="text-brand"
                >
                  დეტალები <ArrowUpRight className="inline" size={12} />
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
