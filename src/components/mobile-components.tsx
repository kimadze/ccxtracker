"use client";

import { X } from "lucide-react";
import { cloneElement, isValidElement, useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";

export function MobileMetricCard({ label, value, hint, tone = "" }: { label: string; value: string; hint?: string; tone?: string }) {
  return <article className="mobile-metric-card"><span>{label}</span><strong className={`numeric ${tone}`}>{value}</strong>{hint && <small>{hint}</small>}</article>;
}

export function MobileBottomSheet({ trigger, title, children }: { trigger: ReactNode; title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const triggerElement = isValidElement(trigger)
    ? cloneElement(trigger as ReactElement<{ onClick?: () => void }>, {
        onClick: () => setOpen(true),
      })
    : trigger;

  return (
    <>
      {triggerElement}
      <dialog
        ref={dialogRef}
        className="modal modal-bottom sm:modal-middle"
        onClose={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      >
        <div className="modal-box max-h-[85dvh] rounded-t-box border border-base-300 bg-base-200 sm:max-w-lg sm:rounded-box">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            className="btn btn-circle btn-ghost btn-sm absolute right-4 top-4"
            aria-label="დახურვა"
            onClick={() => setOpen(false)}
          >
            <X size={18} />
          </button>
          <div className="mt-5 overflow-y-auto">{children}</div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button aria-label="დახურვა">დახურვა</button>
        </form>
      </dialog>
    </>
  );
}
