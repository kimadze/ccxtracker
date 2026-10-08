"use client";
import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { restoreTransaction } from "@/server/transaction-features";
type Undo = {
  portfolioId: string;
  undoId: string;
  expiresAt: string;
  pending?: boolean;
  error?: string;
};
const storageKey = "ccx-transaction-undo";
const empty: Undo[] = [];
let snapshot: Undo[] = empty;
const listeners = new Set<() => void>();
function setItems(update: (old: Undo[]) => Undo[]) {
  const next = update(snapshot);
  if (
    next.length === snapshot.length &&
    next.every((item, index) => item === snapshot[index])
  )
    return;
  snapshot = next;
  try {
    sessionStorage.setItem(
      storageKey,
      JSON.stringify(
        snapshot.map(({ portfolioId, undoId, expiresAt }) => ({
          portfolioId,
          undoId,
          expiresAt,
        })),
      ),
    );
  } catch {
    /* A blocked browser store must not prevent undo. */
  }
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function offerTransactionUndo(value: Undo) {
  setItems((old) => [...old.filter((i) => i.undoId !== value.undoId), value]);
}
export function TransactionUndo() {
  const items = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => empty,
  );
  const router = useRouter();
  useEffect(() => {
    // Keep the original deadline across layout refreshes and page reloads.
    try {
      const stored: unknown = JSON.parse(
        sessionStorage.getItem(storageKey) ?? "[]",
      );
      if (Array.isArray(stored))
        setItems((old) => [
          ...old,
          ...stored.filter(
            (i) =>
              typeof i?.portfolioId === "string" &&
              typeof i?.undoId === "string" &&
              typeof i?.expiresAt === "string" &&
              Date.parse(i.expiresAt) > Date.now() &&
              !old.some((existing) => existing.undoId === i.undoId),
          ),
        ]);
    } catch {
      /* Ignore obsolete or unavailable browser storage. */
    }
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
