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

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="modal modal-middle"
      onClose={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
    >
      <div
        className={clsx(
          "modal-box max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto border border-base-300 bg-base-200 p-5 sm:p-7",
          wide ? "max-w-2xl" : "max-w-lg",
          className,
        )}
      >
          <h2 className="pr-10 text-lg font-semibold tracking-tight">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-base-content/60">
            {description}
          </p>
          <button
            type="button"
            className="btn btn-ghost btn-circle btn-sm absolute right-5 top-5"
            aria-label="დახურვა"
            onClick={() => onOpenChange(false)}
          >
            <X size={18} />
          </button>
          <div className="mt-6">{children}</div>
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
        error
          ? "alert-error"
          : "alert-info",
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
        ? "select select-bordered w-full"
        : children.type === "textarea"
          ? "textarea textarea-bordered w-full"
          : children.type === "input" && childProps?.type !== "checkbox"
            ? "input input-bordered w-full"
            : ""
      : ""
    : "";
  return (
    <fieldset className="fieldset">
      <legend className="fieldset-legend">{label}</legend>
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
