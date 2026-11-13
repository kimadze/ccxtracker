"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { refreshPortfolioPrices } from "@/server/actions";

export function PortfolioPriceRefresh({
  portfolioId,
  warning,
}: {
  portfolioId: string;
  warning?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ refreshed: boolean; message: string }>();
  if (!warning && !result && !pending) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 sm:col-span-2">
      <p role="status" className={`text-xs ${result?.refreshed ? "text-success" : "text-warning"}`}>
        {pending ? "ფასები ახლდება…" : result?.message ?? warning}
      </p>
      {warning && (
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
          ფასების განახლება
        </button>
      )}
    </div>
  );
}
