"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, ChartNoAxesCombined, Search } from "lucide-react";
import type { ValuedPosition } from "@/domain/types";
import {
  money,
  percentage,
  pnlClass,
  quantity,
  unitPrice,
} from "@/lib/formatters";
import { AssetIcon } from "./positions";
import { BalanceValue } from "./ui";
import { OverviewToolbar } from "./overview-toolbar";
import { WorkspaceTabs } from "./workspace-tabs";

export function OverviewAssets({
  positions,
  base,
  positionsPanel,
  transactionsPanel,
}: {
  positions: ValuedPosition[];
  base: string;
  positionsPanel: ReactNode;
  transactionsPanel: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("assets");
  const router = useRouter();
  const filtered = positions.filter((p) =>
    `${p.asset.symbol} ${p.asset.name}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const search = (
    <label className="input input-sm min-h-11 w-full min-w-0 bg-base-200 text-xs focus-within:outline-primary">
      <Search size={15} className="shrink-0 text-base-content/50" />
      <input
        aria-label="აქტივის ძიება"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="აქტივის ძიება (BTC, ETH…)"
      />
    </label>
  );
  return (
    <section className="min-w-0 lg:col-span-2" aria-label="პორტფელის აქტივები">
      <h2 className="sr-only">აქტივები</h2>
      {tab === "assets" && (
        <OverviewToolbar targetId="overview-search">{search}</OverviewToolbar>
      )}
      <WorkspaceTabs
        label="პორტფელის სექციები"
        value={tab}
        onChange={setTab}
        items={[
          ["assets", "აქტივები"],
          ["positions", "პოზიციები"],
          ["transactions", "ტრანზაქციები"],
        ]}
      >
        {tab === "positions" ? (
          positionsPanel
        ) : tab === "transactions" ? (
          transactionsPanel
        ) : (
          <>
            <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
              <div className="min-w-0 max-w-sm flex-1 xl:hidden">{search}</div>
              <button
                type="button"
                className="btn btn-ghost btn-sm hidden min-h-11 gap-1 px-2 text-xs text-base-content/60 sm:inline-flex"
                onClick={() => setTab("positions")}
              >
                ყველა ({positions.length}) <ArrowUpRight size={14} />
              </button>
            </div>
            <div className="card card-border min-w-0 border-base-300 bg-base-200">
              <ul className="list lg:hidden">
                {filtered.slice(0, 6).map((p, i) => (
                  <li
                    key={p.assetId}
                    className="list-row block rounded-none border-b border-base-300 p-0 last:border-0"
                  >
                    <Link
                      href={`${base}/positions/${encodeURIComponent(p.assetId)}`}
                      className="flex min-h-[68px] min-w-0 items-center gap-2.5 px-3 py-2.5 hover:bg-base-300/40 focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      <AssetIcon
                        symbol={p.asset.symbol}
                        logoUrl={p.asset.logoUrl}
                        index={i}
                        size={32}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">
                          {p.asset.symbol}
                        </span>
                        <span
                          title={p.asset.name}
                          className="block max-w-32 truncate text-xs text-base-content/50"
                        >
                          {p.asset.name}
                        </span>
                      </span>
                      <span className="min-w-0 max-w-[65%] text-right tabular-nums">
                        <span className="block overflow-x-auto whitespace-nowrap text-sm font-semibold">
                          <BalanceValue>{money(p.value)}</BalanceValue>
                        </span>
                        <span
                          className={`block overflow-x-auto whitespace-nowrap text-xs ${pnlClass(p.unrealizedPnl)}`}
                        >
                          <BalanceValue>
                            {money(p.unrealizedPnl)} ·{" "}
                            {percentage(p.returnPercent, true)}
                          </BalanceValue>
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-x-auto lg:block">
                <table className="table table-sm w-full text-xs [&_th]:px-3 [&_td]:px-3 [&_td]:py-1">
                  <thead>
                    <tr className="text-xs text-base-content/55">
                      <th>აქტივი</th>
                      <th className="hidden text-right xl:table-cell">
                        რაოდენობა
                      </th>
                      <th className="text-right">ფასი (USD)</th>
                      <th className="text-right">ღირებულება</th>
                      <th
                        className="text-right"
                        title="დარჩენილი პოზიციის არარეალიზებული მოგება/ზარალი"
                      >
                        P/L (USD)
                      </th>
                      <th className="hidden text-right 2xl:table-cell">
                        P/L %
                      </th>
                      <th className="text-right">
                        <span className="sr-only">მოქმედებები</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 6).map((p, i) => {
                      const href = `${base}/positions/${encodeURIComponent(p.assetId)}`;
                      return (
                        <tr
                          key={p.assetId}
                          className="cursor-pointer hover:bg-base-300/35"
                          onClick={(event) => {
                            if (
                              !(event.target as HTMLElement).closest(
                                "a,button,summary",
                              )
                            )
                              router.push(href);
                          }}
                        >
                          <td>
                            <Link
                              href={href}
                              className="flex min-h-11 items-center gap-2.5"
                            >
                              <AssetIcon
                                symbol={p.asset.symbol}
                                logoUrl={p.asset.logoUrl}
                                index={i}
                                size={32}
                              />
                              <span className="min-w-0">
                                <span className="block font-semibold">
                                  {p.asset.symbol}
                                </span>
                                <span
                                  title={p.asset.name}
                                  className="block max-w-24 truncate text-xs text-base-content/50 2xl:max-w-36"
                                >
                                  {p.asset.name}
                                </span>
                              </span>
                            </Link>
                          </td>
                          <td className="hidden whitespace-nowrap text-right tabular-nums xl:table-cell">
                            <BalanceValue>{quantity(p.quantity)}</BalanceValue>
                          </td>
                          <td className="whitespace-nowrap text-right tabular-nums">
                            {unitPrice(p.quote?.price)}
                            {p.quote?.stale && (
                              <span className="block text-[10px] text-warning">
                                მოძველებული
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap text-right font-semibold tabular-nums">
                            <BalanceValue>{money(p.value)}</BalanceValue>
                          </td>
                          <td
                            className={`whitespace-nowrap text-right tabular-nums ${pnlClass(p.unrealizedPnl)}`}
                          >
                            <BalanceValue>
                              {money(p.unrealizedPnl)}
                            </BalanceValue>
                            <span className="block text-[10px] 2xl:hidden">
                              <BalanceValue>
                                {percentage(p.returnPercent, true)}
                              </BalanceValue>
                            </span>
                          </td>
                          <td
                            className={`hidden whitespace-nowrap text-right tabular-nums 2xl:table-cell ${pnlClass(p.returnPercent)}`}
                          >
                            <BalanceValue>
                              {percentage(p.returnPercent, true)}
                            </BalanceValue>
                          </td>
                          <td>
                            <div className="flex justify-end gap-1">
                              <Link
                                href={href + "?tab=plan"}
                                className="btn btn-ghost btn-square btn-sm min-h-11 min-w-11 text-base-content/55"
                                aria-label={p.asset.symbol + " გაყიდვის გეგმა"}
                                title="გაყიდვის გეგმა"
                              >
                                <ChartNoAxesCombined size={16} />
                              </Link>
                              <Link
                                href={href}
                                className="btn btn-ghost btn-square btn-sm min-h-11 min-w-11 text-base-content/55"
                                aria-label={p.asset.symbol + " დეტალები"}
                                title="დეტალები"
                              >
                                <ArrowUpRight size={16} />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!filtered.length && (
                <p className="px-4 py-5 text-sm text-base-content/55">
                  {positions.length
                    ? "აქტივი ვერ მოიძებნა"
                    : "პოზიციები ჯერ არ არის"}
                </p>
              )}
            </div>
          </>
        )}
      </WorkspaceTabs>
    </section>
  );
}
