"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, X } from "lucide-react";
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
    <>
      <p role="status" className="sr-only">
        {pending ? "ფასები ახლდება…" : result?.message}
      </p>
      {(canRefresh || pending) && (
        <button
          type="button"
          disabled={pending}
          aria-busy={pending}
          aria-label={pending ? "ფასები ახლდება…" : "ფასების განახლება"}
          title="ფასების განახლება"
          className="btn btn-ghost btn-square min-h-11 min-w-11 shrink-0 motion-safe:transition-transform motion-safe:active:scale-[0.98]"
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
        </button>
      )}
      {result && !pending && (
        <div className="absolute top-full left-0 z-30 mt-1 flex w-64 max-w-[calc(100vw-2rem)] items-center gap-1 rounded-box border border-base-300 bg-base-200 p-2 shadow-lg lg:right-0 lg:left-auto">
          <p aria-hidden="true" className={`flex-1 pl-1 text-xs leading-5 ${result.refreshed ? "text-success" : "text-warning"}`}>
            {result.message}
          </p>
          <button
            type="button"
            className="btn btn-ghost btn-square min-h-11 min-w-11 shrink-0"
            aria-label="განახლების შეტყობინების დახურვა"
            onClick={() => setResult(undefined)}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </>
  );
}
