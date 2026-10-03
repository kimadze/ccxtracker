import Link from "next/link";
import { ArrowUpRight, Wallet } from "lucide-react";
import type { PortfolioSummary } from "@/domain/types";
import { decimal, percent } from "@/domain/decimal";
import { isInvestableCrypto } from "@/domain/portfolio-segments";
import { money, percentage, pnlClass } from "@/lib/formatters";
import { AssetIcon } from "./positions";
import { BalanceValue } from "./ui";

export function PortfolioCard({
  id,
  name,
  summary,
}: {
  id: string;
  name: string;
  summary: PortfolioSummary;
}) {
  const assets = summary.positions.filter(
    (p) => isInvestableCrypto(p.asset) && decimal(p.quantity).gt(0),
  );
  const leading = [...assets]
    .sort((a, b) => decimal(b.value ?? 0).cmp(a.value ?? 0))
    .slice(0, 4);
  const liquidityShare =
    summary.liquidity !== null &&
    summary.value !== null &&
    decimal(summary.value).gt(0)
      ? percent(summary.liquidity, summary.value)
      : null;
  return (
    <Link
      href={`/portfolios/${id}`}
      className="card card-border group min-w-0 bg-base-200 transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      aria-label={`${name} — გახსნა`}
    >
      <div className="card-body gap-4 p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-base-300 bg-base-100 text-base-content/70">
            <Wallet size={20} />
          </span>
          <h2
            className="min-w-0 flex-1 truncate text-base font-semibold"
            title={name}
          >
            {name}
          </h2>
          <ArrowUpRight
            size={18}
            className="shrink-0 text-base-content/40 group-hover:text-primary"
            aria-hidden="true"
          />
        </div>
        <div className="min-w-0">
          <p className="mb-1 text-xs text-base-content/60">
            მიმდინარე ღირებულება
          </p>
          <p className="overflow-x-auto whitespace-nowrap text-[28px] font-semibold leading-tight tabular-nums">
            <BalanceValue>{money(summary.value)}</BalanceValue>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="text-base-content/60">მთლიანი P/L</span>
            <span
              className={`whitespace-nowrap font-medium tabular-nums ${pnlClass(summary.totalPnl)}`}
            >
              <BalanceValue>{money(summary.totalPnl)}</BalanceValue>
            </span>
          </div>
          {(!summary.complete || summary.stale) && (
            <p className="mt-2 text-xs text-warning">
              {!summary.complete
                ? "ფასები არასრულია"
                : "ფასები განახლებას საჭიროებს"}
            </p>
          )}
        </div>
        <div className="flex min-w-0 items-center justify-between gap-3 border-t border-base-300 pt-3">
          <div className="min-w-0">
            <p className="text-xs text-base-content/60">
              {assets.length} კრიპტოაქტივი
            </p>
            <div className="mt-2 flex gap-1.5" aria-hidden="true">
              {leading.map((p) => (
                <AssetIcon
                  key={p.assetId}
                  symbol={p.asset.symbol}
                  logoUrl={p.asset.logoUrl}
                  size={24}
                />
              ))}
            </div>
          </div>
          <div className="min-w-0 text-right">
            <p className="text-xs text-base-content/60">ლიკვიდობა</p>
            <p className="mt-1 overflow-x-auto whitespace-nowrap text-sm font-medium tabular-nums">
              <BalanceValue>{money(summary.liquidity)}</BalanceValue>
            </p>
            {liquidityShare !== null && (
              <p className="mt-1 text-xs text-base-content/60">
                <BalanceValue>{percentage(liquidityShare)}</BalanceValue>
              </p>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
