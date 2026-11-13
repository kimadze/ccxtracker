"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import type { ValuedPosition } from "@/domain/types";
import { money, percentage, pnlClass, quantity, unitPrice } from "@/lib/formatters";
import { BalanceValue, Modal } from "./ui";

export function OverviewAssetTrigger({
  position,
  base,
  className,
  children,
}: {
  position: ValuedPosition;
  base: string;
  className: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={position.asset.symbol + " შედეგები"}
        className={className}
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      {open && (
        <OverviewAssetResult position={position} base={base} open={open} onOpenChange={setOpen} />
      )}
    </>
  );
}

export function OverviewAssetResult({
  position,
  base,
  open,
  onOpenChange,
}: {
  position: ValuedPosition;
  base: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const metrics = [
    { label: "ღირებულება", value: money(position.value) },
    {
      label: "არარეალიზებული P/L",
      value: `${money(position.unrealizedPnl)} · ${percentage(position.returnPercent, true)}`,
      tone: pnlClass(position.unrealizedPnl),
    },
    { label: "რაოდენობა", value: quantity(position.quantity) },
    { label: "საშუალო ფასი", value: unitPrice(position.averagePrice) },
    { label: "მიმდინარე ფასი", value: unitPrice(position.quote?.price), public: true },
  ];
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={position.asset.symbol}
      description={position.asset.name}
      className="max-w-sm"
    >
      <dl className="portfolio-create-reveal divide-y divide-base-content/10 rounded-xl bg-base-200/60 px-3 text-sm">
        {metrics.map(({ label, value, tone, public: isPublic }) => (
          <div key={label} className="flex flex-wrap justify-between gap-x-3 gap-y-1 py-2.5">
            <dt className="text-base-content/75">{label}</dt>
            <dd className={`ml-auto min-w-0 break-all text-right font-medium tabular-nums ${tone ?? ""}`}>
              {isPublic ? value : <BalanceValue>{value}</BalanceValue>}
            </dd>
          </div>
        ))}
      </dl>
      {(!position.quote || position.quote.stale) && (
        <p className="mt-2 text-xs text-warning">
          {position.quote ? "ფასი დაგვიანებულია" : "მიმდინარე ფასი მიუწვდომელია"}
        </p>
      )}
      <Link
        href={`${base}/positions/${encodeURIComponent(position.assetId)}`}
        className="btn btn-ghost mt-2 min-h-11 w-full"
        onClick={() => onOpenChange(false)}
      >
        სრული დეტალები <ArrowUpRight size={16} aria-hidden="true" />
      </Link>
    </Modal>
  );
}
