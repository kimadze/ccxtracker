"use client";

import { useCallback, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const subscribe = (notify: () => void) => {
  const observer = new MutationObserver(notify);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
};
const getServerTarget = () => null;

export function OverviewToolbar({
  children,
  targetId = "overview-toolbar",
}: {
  children: ReactNode;
  targetId?: string;
}) {
  const getTarget = useCallback(
    () => document.getElementById(targetId),
    [targetId],
  );
  const target = useSyncExternalStore(subscribe, getTarget, getServerTarget);
  return target ? createPortal(children, target) : null;
}
