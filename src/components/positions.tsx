"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { ArrowUpRight, Layers3, NotebookPen, TrendingUp } from "lucide-react";
import type { ValuedPosition } from "@/domain/types";
import {
  money,
  percentage,
  quantity,
  pnlClass,
  unitPrice,
} from "@/lib/formatters";
import { BalanceValue } from "./ui";
import { highResLogoUrl } from "@/lib/asset-logo";

const colors = [
  "text-primary",
  "text-secondary",
  "text-accent",
  "text-warning",
  "text-info",
];

export function AssetIcon({
  symbol,
  logoUrl,
  index = 0,
  size = 36,
}: {
  symbol: string;
  logoUrl?: string | null;
  index?: number;
  size?: number;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const source = highResLogoUrl(logoUrl);
  return (
    <div className="avatar avatar-placeholder shrink-0">
      <div
        className={`mask mask-circle grid place-items-center border border-base-300 bg-base-300 ${colors[index % colors.length]}`}
        style={{ width: size, height: size }}
      >
        {source && !imageFailed ? (
          <Image
            unoptimized
            src={source}
            alt=""
            width={size}
            height={size}
            onError={() => setImageFailed(true)}
            className="size-full object-contain p-px"
          />
        ) : (
          <span className="text-xs font-semibold">{symbol.slice(0, 3)}</span>
        )}
      </div>
    </div>
  );
}

export function PositionsTable({
  positions,
  base,
  preview = false,
  view = "auto",
  onSelect,
}: {
  positions: ValuedPosition[];
  base: string;
  preview?: boolean;
  view?: "auto" | "cards";
  selectedAssetId?: string;
  onSelect?: (assetId: string) => void;
}) {
  if (!positions.length)
    return (
      <div className="hero min-h-32 rounded-box border border-dashed border-base-300 bg-base-200">
        <div className="hero-content text-center">
          <div className="max-w-md">
            <span className="mx-auto grid size-12 place-items-center rounded-box bg-base-300 text-primary">
              <Layers3 size={24} />
            </span>
            <h3 className="mt-4 text-lg font-semibold">
              პოზიციები ჯერ არ არის დამატებული
            </h3>
            <p className="mt-2 text-sm text-base-content/55">
              დაამატეთ პირველი ტრანზაქცია.
            </p>
          </div>
        </div>
      </div>
    );

  return (
    <>
      <div
        className={
          view === "cards"
            ? "hidden"
            : "hidden overflow-x-auto rounded-box border border-base-300 bg-base-200 lg:block"
        }
      >
        <table className="table table-sm [&_th]:text-right [&_th:first-child]:text-left [&_td]:text-right [&_td:first-child]:text-left">
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
              ].map((heading, index) => (
                <th
                  key={heading}
                  className={
                    [1, 2, 6].includes(index)
                      ? "hidden xl:table-cell"
                      : undefined
                  }
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map((position, index) => (
              <tr
                key={position.assetId}
                className="hover:bg-base-300/40"
                onClick={() => onSelect?.(position.assetId)}
              >
                <td>
                  <div className="flex items-center gap-3">
                    <AssetIcon
                      symbol={position.asset.symbol}
                      logoUrl={position.asset.logoUrl}
                      index={index}
                    />
                    <div className="min-w-0 max-w-48">
                      {preview ? (
                        <span className="font-semibold">
                          {position.asset.name}
                        </span>
                      ) : (
                        <Link
                          className="block truncate font-semibold hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                          title={position.asset.name}
                          href={`${base}/positions/${position.assetId}`}
                        >
                          {position.asset.name}
                        </Link>
                      )}
                      <div className="text-xs text-base-content/50">
                        {position.asset.symbol}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="numeric hidden xl:table-cell">
                  <BalanceValue>{quantity(position.quantity)}</BalanceValue>
                </td>
                <td className="numeric hidden text-base-content/60 xl:table-cell">
                  <BalanceValue>
                    {unitPrice(position.averagePrice)}
                  </BalanceValue>
                </td>
                <td>
                  <div className="numeric">
                    {unitPrice(position.quote?.price ?? null)}
                  </div>
                  <div
                    className={`text-xs ${pnlClass(position.quote?.change24h ?? null)}`}
                  >
                    {percentage(position.quote?.change24h ?? null, true)}
                  </div>
                </td>
                <td className="numeric font-semibold">
                  <BalanceValue>{money(position.value)}</BalanceValue>
                </td>
                <td className={pnlClass(position.unrealizedPnl)}>
                  <div className="numeric">
                    <BalanceValue>
                      {position.unrealizedPnl &&
                      Number(position.unrealizedPnl) > 0
                        ? "+"
                        : ""}
                      {money(position.unrealizedPnl)}
                    </BalanceValue>
                  </div>
                  <div className="text-xs">
                    {percentage(position.returnPercent, true)}
                  </div>
                </td>
                <td className="hidden xl:table-cell">
                  <div className="numeric">
                    {percentage(position.allocation)}
                  </div>
                  <progress
                    className="progress progress-primary mt-2 w-16"
                    value={Math.min(Number(position.allocation ?? 0), 100)}
                    max="100"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="list divide-y divide-base-300 rounded-box border border-base-300 bg-base-200 lg:hidden">
        {positions.map((position, index) => (
          <li key={position.assetId}>
            <Link
              href={`${base}/positions/${position.assetId}`}
              className="flex min-h-16 min-w-0 items-center gap-3 px-3 py-2 hover:bg-base-300/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <AssetIcon
                symbol={position.asset.symbol}
                logoUrl={position.asset.logoUrl}
                index={index}
                size={32}
              />
              <div className="min-w-0 flex-1">
                <span className="font-semibold">{position.asset.symbol}</span>
                <p className="truncate text-xs text-base-content/60">
                  {position.asset.name}
                </p>
              </div>
              <div className="shrink-0 text-right tabular-nums">
                <p className="whitespace-nowrap font-semibold">
                  <BalanceValue>{money(position.value)}</BalanceValue>
                </p>
                <p className={`text-xs ${pnlClass(position.returnPercent)}`}>
                  {percentage(position.returnPercent, true)}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <div
        className={
          view === "cards"
            ? "hidden gap-3 lg:grid lg:grid-cols-2 xl:grid-cols-3"
            : "hidden lg:hidden"
        }
      >
        {positions.map((position, index) => (
          <article
            key={position.assetId}
            onClick={() => onSelect?.(position.assetId)}
            className="card border border-base-300 bg-base-200"
          >
            <div className="card-body gap-4 p-4">
              <div className="flex items-center gap-3">
                <AssetIcon
                  symbol={position.asset.symbol}
                  logoUrl={position.asset.logoUrl}
                  index={index}
                  size={42}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">{position.asset.symbol}</h3>
                  <p className="truncate text-sm text-base-content/50">
                    {position.asset.name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">
                    <BalanceValue>{money(position.value)}</BalanceValue>
                  </p>
                  <p className={`text-sm ${pnlClass(position.returnPercent)}`}>
                    {percentage(position.returnPercent, true)}
                  </p>
                </div>
              </div>
              <div className="stats stats-vertical border border-base-300 bg-base-100 sm:stats-horizontal">
                <div className="stat p-3">
                  <div className="stat-title text-xs">მიმდინარე ფასი</div>
                  <div className="stat-value text-base">
                    {unitPrice(position.quote?.price ?? null)}
                  </div>
                </div>
                <div className="stat p-3">
                  <div className="stat-title text-xs">საშ. შესყიდვა</div>
                  <div className="stat-value text-base">
                    <BalanceValue>
                      {unitPrice(position.averagePrice)}
                    </BalanceValue>
                  </div>
                </div>
              </div>
              {!preview && (
                <div className="card-actions grid grid-cols-3">
                  <Link
                    href={`${base}/positions/${position.assetId}?tab=exit`}
                    className="btn btn-dash btn-sm"
                  >
                    <TrendingUp size={14} /> გეგმა
                  </Link>
                  <Link
                    href={`${base}/positions/${position.assetId}?tab=journal`}
                    className="btn btn-dash btn-sm"
                  >
                    <NotebookPen size={14} /> ჟურნალი
                  </Link>
                  <Link
                    href={`${base}/positions/${position.assetId}`}
                    className="btn btn-dash btn-sm"
                  >
                    დეტალები <ArrowUpRight size={14} />
                  </Link>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
