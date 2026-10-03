"use client";
import { useEffect, useRef, type ReactNode } from "react";

/** Expand the workspace on desktop while preserving native disclosure controls. */
export function ResponsiveDisclosure({
  children,
  className,
  open = false,
}: {
  children: ReactNode;
  className: string;
  open?: boolean;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => {
      if (ref.current) ref.current.open = query.matches || open;
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [open]);
  return (
    <details ref={ref} open={open} className={className}>
      {children}
    </details>
  );
}
