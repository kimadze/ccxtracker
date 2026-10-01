"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { clsx } from "clsx";
import {
  cloneElement,
  isValidElement,
  useId,
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
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-backdrop ccx-modal-overlay fixed inset-0 z-50 bg-black/70" />
        <Dialog.Content
          className={clsx(
            "modal-box ccx-modal fixed z-50 max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-xl border border-line bg-surface p-5 sm:p-7",
            wide ? "max-w-2xl" : "max-w-lg",
            className,
          )}
        >
          <Dialog.Title className="pr-8 text-base font-semibold tracking-tight">
            {title}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-xs leading-6 text-muted">
            {description}
          </Dialog.Description>
          <Dialog.Close
            className="absolute right-5 top-5 rounded-lg border border-transparent p-1 text-muted hover:border-line hover:text-foreground"
            aria-label="დახურვა"
          >
            <X size={18} />
          </Dialog.Close>
          <div className="mt-6">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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
    <p
      role={error ? "alert" : "status"}
      className={clsx(
        "alert rounded-lg border p-3 text-xs leading-6",
        error
          ? "alert-error border-negative/20 bg-negative/5 text-negative"
          : "alert-info border-brand/20 bg-brand/5 text-brand",
      )}
    >
      {children}
    </p>
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
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {isValidElement(children)
        ? cloneElement(
            children as ReactElement<{ id?: string; className?: string }>,
            {
              id,
              className: clsx(control, childProps?.className),
            },
          )
        : children}
    </div>
  );
}
