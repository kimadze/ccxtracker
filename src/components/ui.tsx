"use client";
import { X } from "lucide-react";
import { clsx } from "clsx";
import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type ReactElement,
} from "react";

export function BalanceValue({ children }: { children: ReactNode }) {
  return <span className="balance-value">{children}</span>;
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  wide?: boolean;
  className?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="modal modal-bottom lg:modal-middle"
      onClose={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
    >
      <div
        className={clsx(
          "modal-box max-h-[90dvh] w-full overflow-y-auto rounded-t-box border border-base-300 bg-base-200 p-4 pb-[calc(16px+env(safe-area-inset-bottom))] lg:w-[calc(100%-2rem)] lg:rounded-box lg:p-5",
          wide ? "max-w-2xl" : "max-w-lg",
          className,
        )}
      >
        <h2 id={titleId} className="pr-10 text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <p className="mt-1 text-xs text-base-content/60">{description}</p>
        <button
          type="button"
          className="btn btn-ghost btn-circle min-h-11 min-w-11 absolute right-5 top-5"
          aria-label="დახურვა"
          onClick={() => onOpenChange(false)}
        >
          <X size={18} />
        </button>
        <div className="mt-3">{children}</div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button aria-label="დახურვა">დახურვა</button>
      </form>
    </dialog>
  );
}
export function Message({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      role={error ? "alert" : "status"}
      className={clsx(
        "alert alert-soft text-sm",
        error ? "alert-error" : "alert-info",
      )}
    >
      {children}
    </div>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const id = useId();
  const childProps = isValidElement(children)
    ? (children.props as { type?: string; className?: string })
    : undefined;
  const control = isValidElement(children)
    ? typeof children.type === "string"
      ? children.type === "select"
        ? "select w-full"
        : children.type === "textarea"
          ? "textarea w-full"
          : children.type === "input" && childProps?.type !== "checkbox"
            ? "input w-full"
            : ""
      : ""
    : "";
  return (
    <fieldset className="fieldset min-w-0">
      <legend className="fieldset-legend max-w-full whitespace-normal">
        <label htmlFor={id}>{label}</label>
      </legend>
      {isValidElement(children)
        ? cloneElement(
            children as ReactElement<{ id?: string; className?: string }>,
            {
              id,
              className: clsx(control, childProps?.className),
            },
          )
        : children}
    </fieldset>
  );
}
