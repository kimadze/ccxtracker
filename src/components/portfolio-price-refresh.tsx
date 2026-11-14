"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { refreshPortfolioPrices } from "@/server/actions";

export function PortfolioPriceRefresh({
  portfolioId,
  canRefresh,
}: {
  portfolioId: string;
  canRefresh: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ refreshed: boolean; message: string }>();
  if (!canRefresh && !result && !pending) return null;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2">
      <p role="status" className="sr-only">
        {pending ? "ფასები ახლდება…" : result?.message}
      </p>
      {(canRefresh || pending) && (
        <button
          type="button"
          disabled={pending}
          aria-busy={pending}
          className="btn btn-ghost min-h-11 gap-2 text-xs motion-safe:transition-transform motion-safe:active:scale-[0.98]"
          onClick={() => {
            startTransition(async () => {
              setResult(undefined);
              try {
                setResult(await refreshPortfolioPrices(portfolioId));
                router.refresh();
              } catch {
                setResult({ refreshed: false, message: "განახლება ვერ მოხერხდა. სცადეთ ხელახლა." });
              }
            });
          }}
        >
          <RefreshCw size={16} aria-hidden="true" className={pending ? "motion-safe:animate-spin" : ""} />
          {pending ? "ფასები ახლდება…" : "ფასების განახლება"}
        </button>
      )}
      {result && !pending && (
        <p aria-hidden="true" className={`max-w-44 text-xs ${result.refreshed ? "text-success" : "text-warning"}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}
