"use client";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { NextStep } from "@/domain/next-steps";
import { percentage, unitPrice } from "@/lib/formatters";
import { AssetIcon } from "./positions";
import { BalanceValue } from "./ui";
export function NextSteps({
  rows,
  base,
}: {
  rows: NextStep[];
  total: number;
  base: string;
}) {
  return (
    <section aria-labelledby="next-steps-title" className="min-w-0">
      <div className="flex items-center justify-between gap-2 border-b border-base-300 pb-2">
        <h2 id="next-steps-title" className="text-sm font-semibold">
          უახლოესი სამიზნეები
        </h2>
        <Link
          href={`${base}/watchlist`}
          className="btn btn-ghost min-h-11 px-2 text-xs text-base-content/60"
        >
          ალერტები <ChevronRight size={14} />
        </Link>
      </div>
      {rows.length ? (
        <ul className="list divide-y divide-base-300">
          {rows.map((row) => {
            const title =
              row.kind === "tp"
                ? `TP${row.level}`
                : row.kind === "fall"
                  ? "ვარდნა"
                  : "ზრდა";
            return (
              <li key={row.id}>
                <Link
                  href={
                    row.kind === "tp"
                      ? `${base}/positions/${encodeURIComponent(row.asset.id)}?tab=exit`
                      : `${base}/watchlist`
                  }
                  className="list-row grid-cols-[32px_minmax(0,1fr)_auto]! items-center gap-3 rounded-field px-0 py-3 transition-colors hover:bg-base-300/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <AssetIcon
                    symbol={row.asset.symbol}
                    logoUrl={row.asset.logoUrl}
                    size={32}
                  />
                  <div className="min-w-0">
                    <div
                      className="truncate text-sm font-semibold"
                      title={row.asset.name}
                    >
                      {row.asset.symbol} · {title}
                    </div>
                    <div className="mt-1 text-xs text-base-content/60">
                      ახლა <BalanceValue>{unitPrice(row.current)}</BalanceValue>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="whitespace-nowrap font-mono text-sm font-semibold tabular-nums">
                      <BalanceValue>{unitPrice(row.target)}</BalanceValue>
                    </div>
                    <div
                      className={`mt-1 text-xs ${row.reached ? "text-success" : row.distance === null ? "text-base-content/50" : row.kind === "fall" ? "text-info" : "text-warning"}`}
                    >
                      {row.reached ? (
                        "მიღწევა დაფიქსირდა"
                      ) : row.distance === null ? (
                        "ფასი მიუწვდომელია"
                      ) : (
                        <BalanceValue>
                          სამიზნემდე {percentage(row.distance, true)}
                        </BalanceValue>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="py-4 text-sm text-base-content/60">
          სამიზნეები ჯერ არ გაქვს.
        </p>
      )}
      <Link
        href={`${base}/planning?tab=strategy`}
        className="btn btn-ghost min-h-11 px-0 text-xs text-base-content/60"
      >
        გეგმების ნახვა <ChevronRight size={14} />
      </Link>
    </section>
  );
}
