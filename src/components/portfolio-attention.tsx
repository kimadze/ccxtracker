import type { ReactNode } from "react";
import { WatchlistDialog } from "./watchlist-dialog";
import Link from "next/link";
import { ArrowUpRight, Bell, Eye } from "lucide-react";
import { usableAlertQuote } from "@/domain/alert-quote";
import { decimal, percent } from "@/domain/decimal";
import type { Asset, Quote, ValuedPosition } from "@/domain/types";
import { percentage, pnlClass, unitPrice } from "@/lib/formatters";
import { AssetIcon } from "./positions";
import { BalanceValue } from "./ui";

type WatchItem = {
  asset: Pick<Asset, "id" | "symbol" | "logoUrl">;
  entryPrice: string | null;
  exitPrice: string | null;
};

export function PortfolioAttention({
  base,
  positions,
  items,
  quotes,
  watchlistPanel,
}: {
  base: string;
  positions: ValuedPosition[];
  items: WatchItem[];
  quotes: Quote[];
  watchlistPanel: ReactNode;
}) {
  const now = Date.now();
  const quotesById = new Map(quotes.map((quote) => [quote.assetId, quote]));
  const heldIds = new Set(positions.map(({ asset }) => asset.id));
  const watchlistHref = `${base}/watchlist`;
  const assetHref = (assetId: string) =>
    heldIds.has(assetId)
      ? `${base}/positions/${encodeURIComponent(assetId)}`
      : watchlistHref;
  const stale = positions.filter(
    (position) => !usableAlertQuote(position.quote ?? undefined, now),
  );
  const nearTargets = items
    .flatMap(({ asset, entryPrice, exitPrice }) => {
      const quote = quotesById.get(asset.id);
      if (!usableAlertQuote(quote, now)) return [];
      return (
        [
          ["buy", entryPrice],
          ["sell", exitPrice],
        ] as const
      ).flatMap(([side, target]) => {
        if (!target || !decimal(target).gt(0)) return [];
        const gap = decimal(quote.price).minus(target);
        if (side === "buy" ? !gap.gt(0) : !gap.lt(0)) return [];
        const distance = percent(gap.abs(), target);
        return distance !== null && decimal(distance).lte(5)
          ? [{ asset, side, distance }]
          : [];
      });
    })
    .sort((a, b) => decimal(a.distance).cmp(b.distance))
    .slice(0, 4);

  const alertCount = stale.length + nearTargets.length;
  const chipClass =
    "inline-flex min-h-8 items-center gap-1 rounded-lg border border-base-300 px-2.5 text-xs font-medium transition-colors hover:border-primary/40 hover:text-secondary focus-visible:outline-primary";

  return (
    <aside
      aria-label="პორტფელის ყურადღება"
      className="ccx-overview-attention grid min-w-0 self-start gap-4 lg:gap-5"
    >
      {alertCount > 0 && (
        <section className="ccx-attention-card min-w-0 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Bell
                size={15}
                className="text-base-content/60"
                aria-hidden="true"
              />
              გაფრთხილებები
            </h2>
            {alertCount > 0 && (
              <span className="rounded-md bg-warning/10 px-2 py-0.5 text-xs font-medium tabular-nums text-warning">
                {alertCount}
              </span>
            )}
          </div>
          {stale.length > 0 && (
            <div className="mt-3">
              <p className="text-xs leading-relaxed text-base-content/75">
                ფასები განახლებას საჭიროებს
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {stale.slice(0, 3).map(({ asset }) => (
                  <Link
                    key={asset.id}
                    href={assetHref(asset.id)}
                    className={chipClass}
                  >
                    {asset.symbol}
                    <ArrowUpRight
                      size={11}
                      className="opacity-55"
                      aria-hidden="true"
                    />
                  </Link>
                ))}
                {stale.length > 3 && (
                  <Link href={`${base}/positions`} className={chipClass}>
                    +{stale.length - 3}
                  </Link>
                )}
              </div>
            </div>
          )}
          {nearTargets.length > 0 && (
            <ul className="mt-2 divide-y divide-base-300">
              {nearTargets.map(({ asset, side, distance }) => (
                <li key={`${asset.id}-${side}`}>
                  <Link
                    href={assetHref(asset.id)}
                    className="flex items-center justify-between gap-2 py-2 text-xs hover:text-secondary"
                  >
                    <span>
                      <strong className="font-semibold">{asset.symbol}</strong>
                      <span className="block text-base-content/65">
                        {side === "buy"
                          ? "შესვლის სამიზნემდე"
                          : "გასვლის სამიზნემდე"}
                      </span>
                    </span>
                    <span className="shrink-0 font-medium tabular-nums text-warning">
                      {percentage(distance)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <section className="ccx-attention-card min-w-0 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Eye
              size={15}
              className="text-base-content/60"
              aria-hidden="true"
            />
            დაკვირვების სია
          </h2>
                    <WatchlistDialog>{watchlistPanel}</WatchlistDialog>
        </div>
        {items.length > 0 ? (
          <ul className="mt-1 divide-y divide-base-300">
            {items.slice(0, 5).map(({ asset }, index) => {
              const quote = quotesById.get(asset.id);
              const fresh = usableAlertQuote(quote, now);
              const change = fresh ? quote.change24h : null;
              return (
                <li key={asset.id}>
                  <Link
                    href={assetHref(asset.id)}
                    className="flex min-h-12 items-center justify-between gap-2 py-2 text-xs hover:text-secondary"
                  >
                    <span className="flex min-w-0 items-center gap-2 font-semibold">
                      <AssetIcon
                        symbol={asset.symbol}
                        logoUrl={asset.logoUrl}
                        size={24}
                        index={index}
                      />
                      <span className="truncate">{asset.symbol}</span>
                    </span>
                    <span className="text-right tabular-nums">
                      {quote ? (
                        <>
                          <span className="font-medium">
                            <BalanceValue>
                              {unitPrice(quote.price)}
                            </BalanceValue>
                          </span>
                          {!fresh ? (
                            <span className="block text-[11px] text-base-content/65">
                              მოძველებული ფასი
                            </span>
                          ) : change !== null ? (
                            <span
                              className={`block text-[11px] ${pnlClass(change)}`}
                            >
                              {percentage(change, true)} · 24 სთ
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-[11px] text-base-content/65">
                          ფასი მიუწვდომელია
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="py-3 text-xs text-base-content/65">
            დაამატე მონეტები სრული სიიდან.
          </p>
        )}
      </section>
    </aside>
  );
}
