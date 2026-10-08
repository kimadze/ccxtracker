"use client";
import { X } from "lucide-react";
import { clsx } from "clsx";
import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type ReactElement,
} from "react";
import {
  readPrivacy,
  serverPrivacy,
  subscribePrivacy,
} from "./balance-privacy";
import { useDialogViewport } from "./use-dialog-viewport";

export function BalanceValue({ children }: { children: ReactNode }) {
  const hidden = useSyncExternalStore(
    subscribePrivacy,
    readPrivacy,
    serverPrivacy,
  );
  return (
    <span
      className="balance-value"
      aria-label={hidden ? "თანხა დამალულია" : undefined}
    >
      {hidden ? "••••••" : children}
    </span>
  );
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false,
  className,
  contentClassName,
  closeDisabled = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  wide?: boolean;
  className?: string;
  contentClassName?: string;
  closeDisabled?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useDialogViewport(dialogRef, open);
  const titleId = useId();
  const [hasOpened, setHasOpened] = useState(open);
  if (open && !hasOpened) setHasOpened(true);

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
      onCancel={(event) => {
        if (closeDisabled) event.preventDefault();
        else onOpenChange(false);
      }}
    >
      <div
        className={clsx(
          "modal-box max-h-[90dvh] w-full overflow-y-auto rounded-t-box border border-base-300 bg-base-300 p-4 pb-[calc(16px+env(safe-area-inset-bottom))] lg:w-[calc(100%-2rem)] lg:rounded-box lg:p-5",
          wide ? "max-w-2xl" : "max-w-lg",
          className,
        )}
      >
        <h2
          id={titleId}
          className="pr-12 text-base font-semibold tracking-tight"
        >
          {title}
        </h2>
        {description && (
          <p className="mt-1 pr-12 text-xs leading-5 text-base-content/60">
            {description}
          </p>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-square min-h-11 min-w-11 absolute right-3 top-3"
          aria-label="დახურვა"
          disabled={closeDisabled}
          onClick={() => onOpenChange(false)}
        >
          <X size={18} />
        </button>
        <div className={clsx("mt-3", contentClassName)}>
          {(open || hasOpened) && children}
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button aria-label="დახურვა" disabled={closeDisabled}>
          დახურვა
        </button>
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
        ? "select min-h-11 w-full text-base md:text-sm"
        : children.type === "textarea"
          ? "textarea min-h-24 w-full text-base md:text-sm"
          : children.type === "input" && childProps?.type === "checkbox"
            ? /\btoggle\b/.test(childProps?.className ?? "")
              ? "toggle"
              : "checkbox"
            : children.type === "input" && childProps?.type === "radio"
              ? "radio"
              : children.type === "input" && childProps?.type === "range"
                ? "range w-full"
                : children.type === "input" && childProps?.type === "file"
                  ? "file-input min-h-11 w-full text-base md:text-sm"
                  : children.type === "input" &&
                      !["checkbox", "radio", "hidden"].includes(
                        childProps?.type ?? "text",
                      )
                    ? "input min-h-11 w-full text-base md:text-sm"
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
