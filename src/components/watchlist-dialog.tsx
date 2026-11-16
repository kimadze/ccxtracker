"use client";

import { useId, useRef, type ReactNode } from "react";
import { Maximize2, X } from "lucide-react";

export function WatchlistDialog({ children }: { children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost btn-square btn-sm text-secondary"
        aria-label="დაკვირვების სიის გახსნა"
        title="სრული სია"
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
      >
        <Maximize2 size={16} aria-hidden="true" />
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="modal modal-bottom sm:modal-middle"
      >
        <div className="modal-box max-h-[90dvh] w-full max-w-5xl border border-base-300 bg-base-200">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id={titleId} className="text-base font-semibold">დაკვირვების სია</h2>
            <button
              type="button"
              className="btn btn-ghost btn-square min-h-11 min-w-11"
              aria-label="დახურვა"
              onClick={() => dialogRef.current?.close()}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          {children}
        </div>
        <form method="dialog" className="modal-backdrop">
          <button aria-label="დახურვა">დახურვა</button>
        </form>
      </dialog>
    </>
  );
}
