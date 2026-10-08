"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { restoreTransaction } from "@/server/transaction-features";
type Undo = {
  portfolioId: string;
  undoId: string;
  expiresAt: string;
  pending?: boolean;
  error?: string;
};
export function offerTransactionUndo(value: Undo) {
  window.dispatchEvent(
    new CustomEvent("ccx-transaction-undo", { detail: value }),
  );
}
export function TransactionUndo() {
  const [items, setItems] = useState<Undo[]>([]);
  const router = useRouter();
  useEffect(() => {
    const listener = (event: Event) =>
      setItems((old) => [
        ...old.filter(
          (i) => i.undoId !== (event as CustomEvent<Undo>).detail.undoId,
        ),
        (event as CustomEvent<Undo>).detail,
      ]);
    window.addEventListener("ccx-transaction-undo", listener);
    const timer = setInterval(
      () =>
        setItems((old) =>
          old.filter(
            (i) => i.pending || i.error || Date.parse(i.expiresAt) > Date.now(),
          ),
        ),
      1000,
    );
    return () => {
      window.removeEventListener("ccx-transaction-undo", listener);
      clearInterval(timer);
    };
  }, []);
  return (
    <div
      className="toast toast-end z-50 max-h-[40dvh] max-w-full overflow-y-auto bottom-[calc(4rem+env(safe-area-inset-bottom))] lg:bottom-4"
      aria-live="polite"
    >
      {items.map((item) => (
        <div
          key={item.undoId}
          className="alert flex flex-wrap gap-2 bg-base-200 shadow-lg"
        >
          <span className="text-sm">{item.error || "ტრანზაქცია წაიშალა"}</span>
          {!item.error && (
            <button
              className="btn btn-ghost min-h-11"
              disabled={item.pending}
              onClick={async () => {
                setItems((old) =>
                  old.map((i) =>
                    i.undoId === item.undoId ? { ...i, pending: true } : i,
                  ),
                );
                try {
                  const reply = await restoreTransaction(
                    item.portfolioId,
                    item.undoId,
                  );
                  if (reply.ok) {
                    setItems((old) =>
                      old.filter((i) => i.undoId !== item.undoId),
                    );
                    router.refresh();
                  } else
                    setItems((old) =>
                      old.map((i) =>
                        i.undoId === item.undoId
                          ? { ...i, pending: false, error: reply.error }
                          : i,
                      ),
                    );
                } catch {
                  setItems((old) =>
                    old.map((i) =>
                      i.undoId === item.undoId
                        ? {
                            ...i,
                            pending: false,
                            error: "აღდგენა ვერ მოხერხდა.",
                          }
                        : i,
                    ),
                  );
                }
              }}
            >
              {item.pending ? "აღდგენა…" : "აღდგენა"}
            </button>
          )}
          <button
            className="btn btn-ghost btn-square"
            aria-label="შეტყობინების დახურვა"
            disabled={item.pending}
            onClick={() =>
              setItems((old) => old.filter((i) => i.undoId !== item.undoId))
            }
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
