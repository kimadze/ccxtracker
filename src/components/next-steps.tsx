"use client";
import Link from "next/link";
import { ChevronRight, ArrowUpRight } from "lucide-react";
import type { NextStep } from "@/domain/next-steps";
import { decimal } from "@/domain/decimal";
import { percentage, unitPrice } from "@/lib/formatters";
import { AssetIcon } from "./positions";
import { BalanceValue } from "./ui";
import { useBalancesHidden } from "./balance-privacy";
export function NextSteps({
  rows,
  total,
  base,
}: {
  rows: NextStep[];
  total: number;
  base: string;
}) {
  const hidden = useBalancesHidden();
  return (
    <section aria-labelledby="next-steps-title" className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 id="next-steps-title" className="text-base font-semibold">
          ჩემი შემდეგი ნაბიჯები
        </h2>
        {total > 0 && (
          <span
            className="badge badge-primary badge-outline badge-sm"
            aria-label={`${total} სამიზნე`}
          >
            {total}
          </span>
        )}
      </div>
      {rows.length ? (
        <ul className="list divide-y divide-base-300">
          {rows.map((row) => {
            const title =
              row.kind === "tp"
                ? `TP${row.level}`
                : row.kind === "fall"
                  ? "ვარდნის ალერტი"
                  : "ზრდის ალერტი";
            const href =
              row.kind === "tp"
                ? `${base}/positions/${encodeURIComponent(row.asset.id)}?tab=exit`
                : `${base}/watchlist`;
            return (
              <li key={row.id}>
                <Link
                  href={href}
                  className="list-row grid-cols-[32px_minmax(0,1fr)_16px]! items-center gap-x-3 rounded-field px-0 py-3 transition-colors hover:bg-base-300/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <AssetIcon
                    symbol={row.asset.symbol}
                    logoUrl={row.asset.logoUrl}
                    size={32}
                  />
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className="truncate text-sm font-semibold"
                        title={row.asset.name}
                      >
                        {row.asset.symbol} · {title}
                      </span>
                      <span
                        className={`badge badge-sm h-auto py-1 ${row.reached ? "badge-soft badge-success" : row.distance === null ? "badge-ghost" : `badge-dash ${row.kind === "fall" ? "badge-info" : "badge-warning"}`}`}
                      >
                        {row.reached ? (
                          "მიღწევა დაფიქსირდა"
                        ) : row.distance === null ? (
                          "ფასი მიუწვდომელია"
                        ) : decimal(row.distance).isZero() ? (
                          "ფასი სამიზნესთანაა"
                        ) : (
                          <BalanceValue>
                            სამიზნემდე {percentage(row.distance, true)}
                          </BalanceValue>
                        )}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-base-content/60">
                      <span>
                        მიმდინარე{" "}
                        <BalanceValue>{unitPrice(row.current)}</BalanceValue>
                      </span>
                      <span aria-hidden="true">→</span>
                      <span>
                        სამიზნე{" "}
                        <BalanceValue>{unitPrice(row.target)}</BalanceValue>
                      </span>
                    </div>
                    {row.share && (
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-xs text-base-content/60">
                          დაგეგმილი წილი{" "}
                          <BalanceValue>{percentage(row.share)}</BalanceValue>
                        </span>
                        {!hidden && (
                          <progress
                            className="progress progress-primary h-1.5 w-20 sm:w-28"
                            value={Number(row.share)}
                            max={100}
                            aria-label="დაგეგმილი გასაყიდი წილი"
                          />
                        )}
                      </div>
                    )}
                  </div>
                  <ChevronRight size={16} className="text-base-content/50" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="py-3 text-sm text-base-content/60">
          დააყენე TP ან ფასის ალერტი — აქ უახლოესი სამიზნეები გამოჩნდება.
        </p>
      )}
      <div className="mt-1 flex flex-wrap gap-1">
        <Link
          href={`${base}/planning?tab=strategy`}
          className="btn btn-ghost min-h-11 px-2 text-xs"
        >
          გეგმები <ArrowUpRight size={14} />
        </Link>
        <Link
          href={`${base}/watchlist`}
          className="btn btn-ghost min-h-11 px-2 text-xs"
        >
          ფასის ალერტები <ArrowUpRight size={14} />
        </Link>
      </div>
    </section>
  );
}
