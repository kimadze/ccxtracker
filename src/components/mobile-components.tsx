"use client";

import { X } from "lucide-react";
import { useDialogViewport } from "./use-dialog-viewport";
import {
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

export function MobileMetricCard({
  label,
  value,
  hint,
  tone = "",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <article className="mobile-metric-card">
      <span>{label}</span>
      <strong className={`numeric ${tone}`}>{value}</strong>
      {hint && <small>{hint}</small>}
    </article>
  );
}

export function MobileBottomSheet({
  trigger,
  title,
  children,
}: {
  trigger: ReactNode;
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useDialogViewport(dialogRef, open);

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
        aria-label={title}
        className="modal modal-bottom lg:modal-middle"
        onClose={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      >
        <div className="modal-box max-h-[85dvh] w-full overflow-y-auto rounded-t-box border border-base-300 bg-base-200 p-4 pb-[calc(16px+env(safe-area-inset-bottom))] lg:max-w-lg lg:rounded-box">
          <h2 className="pr-12 text-base font-semibold">{title}</h2>
          <button
            type="button"
            className="btn btn-circle btn-ghost min-h-11 min-w-11 absolute right-3 top-3"
            aria-label="დახურვა"
            onClick={() => setOpen(false)}
          >
            <X size={18} />
          </button>
          <div className="mt-3">{children}</div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button aria-label="დახურვა">დახურვა</button>
        </form>
      </dialog>
    </>
  );
}
