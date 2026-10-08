"use client";

import { clsx } from "clsx";

export function FilterButtons<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: readonly { value: T; label: string; count?: number }[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={clsx(
        "flex max-w-full min-w-0 gap-1 overflow-x-auto rounded-box bg-base-200 p-1 [scrollbar-width:none]",
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={clsx(
            "btn btn-sm min-h-11 shrink-0 gap-2 rounded-field px-3 text-sm",
            value === option.value
              ? "btn-ghost bg-primary/15 text-secondary"
              : "btn-ghost text-base-content/60",
          )}
        >
          <span>{option.label}</span>
          {option.count !== undefined && (
            <span className="badge badge-ghost badge-sm min-w-5 border-0 font-normal tabular-nums">
              {option.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
