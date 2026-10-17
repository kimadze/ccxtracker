"use client";
import { useId } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { confirmDiscardChanges } from "./unsaved-changes";

export function useWorkspaceTab(allowed: readonly string[], fallback: string) {
  const query = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const requested = query.get("tab");
  const tab = requested && allowed.includes(requested) ? requested : fallback;
  const choose = (value: string) => {
    if (value === tab || !confirmDiscardChanges()) return false;
    const next = new URLSearchParams(query.toString());
    next.set("tab", value);
    router.replace(`${pathname}?${next}`, { scroll: false });
    return true;
  };
  return [tab, choose] as const;
}

export function WorkspaceTabs({
  items,
  value,
  onChange,
  label,
  children,
  integrated = false,
}: {
  items: readonly (readonly [string, string])[];
  value: string;
  onChange: (value: string) => void | boolean;
  label: string;
  children: React.ReactNode;
  integrated?: boolean;
}) {
  const id = useId();
  return (
    <div className="min-w-0 space-y-3 lg:space-y-4">
      <div
        className={`flex min-w-0 items-center gap-2 ${integrated ? "border-b border-base-300" : ""}`}
      >
        <div
          className="tabs tabs-border flex min-w-0 flex-1 flex-nowrap overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label={label}
        >
          {items.map(([key, title], index) => (
            <button
              key={key}
              id={`${id}-${key}`}
              type="button"
              role="tab"
              aria-selected={value === key}
              aria-controls={`${id}-panel`}
              tabIndex={value === key ? 0 : -1}
              className={`tab min-h-11 shrink-0 text-sm ${integrated ? "px-3" : ""} ${value === key ? `tab-active ${integrated ? "font-semibold" : ""}` : integrated ? "text-base-content/60" : ""}`}
              onClick={() => onChange(key)}
              onKeyDown={(event) => {
                let next = index;
                if (event.key === "ArrowRight")
                  next = (index + 1) % items.length;
                else if (event.key === "ArrowLeft")
                  next = (index + items.length - 1) % items.length;
                else if (event.key === "Home") next = 0;
                else if (event.key === "End") next = items.length - 1;
                else return;
                event.preventDefault();
                if (onChange(items[next][0]) !== false)
                  document.getElementById(`${id}-${items[next][0]}`)?.focus();
              }}
            >
              {title}
            </button>
          ))}
        </div>
      </div>
      <div
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-${value}`}
        className="min-w-0"
      >
        {children}
      </div>
    </div>
  );
}
