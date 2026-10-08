"use client";
import { useEffect, useState } from "react";
import { previewTransactionChange } from "@/server/transaction-features";
import type { TransactionImpact } from "@/domain/transaction-impact";
import { money, quantity } from "@/lib/formatters";
import { BalanceValue } from "./ui";

export function ImpactPreview({
  portfolioId,
  revision,
  operation,
  input,
  onReady,
  version = 0,
}: {
  portfolioId: string;
  revision: number;
  operation: "create" | "update" | "delete" | "batch";
  input: unknown;
  onReady?: (ready: boolean) => void;
  version?: number;
}) {
  const key = JSON.stringify(input);
  const requestKey = `${revision}:${operation}:${version}:${key}`;
  const [result, setResult] = useState<{
    key: string;
    impact?: TransactionImpact;
    error?: string;
  }>();
  useEffect(() => {
    let active = true;
    onReady?.(false);
    if (!input) return;
    const timer = setTimeout(async () => {
      try {
        const reply = await previewTransactionChange(
          portfolioId,
          revision,
          operation,
          JSON.parse(key),
        );
        if (!active) return;
        setResult(
          reply.ok
            ? { key: requestKey, impact: reply.impact }
            : { key: requestKey, error: reply.error },
        );
        onReady?.(reply.ok);
      } catch {
        if (active)
          setResult({
            key: requestKey,
            error: "შედეგი ვერ გამოითვალა. სცადეთ ხელახლა.",
          });
      }
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
    // Serialized input intentionally avoids re-requesting for equivalent drafts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, portfolioId, revision, operation, version]);
  const current = result?.key === requestKey ? result : undefined;
  return (
    <section
      className="rounded-box border border-base-300 p-3"
      aria-live="polite"
    >
      <h3 className="mb-2 text-sm font-medium">
        ცვლილების შედეგი{" "}
        <span className="text-xs text-base-content/60">ახლა → შემდეგ</span>
      </h3>
      {!input ? (
        <p className="text-xs text-base-content/60">
          შეავსეთ რაოდენობა, ფასი და თარიღი.
        </p>
      ) : !current ? (
        <span
          className="loading loading-spinner loading-sm"
          aria-label="შედეგის გამოთვლა"
        />
      ) : current.error ? (
        <p className="text-xs text-error" role="alert">
          {current.error}
        </p>
      ) : (
        current.impact && (
          <>
            <dl className="space-y-2 text-xs">
              {current.impact.assets.map((asset) => (
                <div key={asset.id} className="space-y-2">
                  <ImpactRow
                    label={`${asset.symbol} · რაოდენობა`}
                    pair={asset.quantity}
                    format={(value) => (value === null ? "—" : quantity(value))}
                  />
                  <ImpactRow
                    label={`${asset.symbol} · თვითღირებულება`}
                    pair={asset.basis}
                    format={money}
                  />
                </div>
              ))}
              <ImpactRow
                label="USD-ის ნაშთი"
                pair={current.impact.cash}
                format={money}
              />
              <ImpactRow
                label="მთლიანი P/L"
                pair={current.impact.pnl}
                format={money}
              />
            </dl>
            {(!current.impact.complete || current.impact.stale) && (
              <p className="mt-2 text-xs text-warning">
                {current.impact.stale
                  ? "ფასები მოძველებულია"
                  : "არასრული შეფასება"}
              </p>
            )}
          </>
        )
      )}
    </section>
  );
}
function ImpactRow({
  label,
  pair,
  format,
}: {
  label: string;
  pair: { before: string | null; after: string | null };
  format: (value: string | null) => string;
}) {
  return (
    <div className="flex flex-wrap justify-between gap-1">
      <dt>{label}</dt>
      <dd className="whitespace-nowrap tabular-nums">
        <BalanceValue>
          {format(pair.before)} → {format(pair.after)}
        </BalanceValue>
      </dd>
    </div>
  );
}
