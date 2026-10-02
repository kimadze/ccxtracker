"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const subscribe = (notify: () => void) => {
  const observer = new MutationObserver(notify);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
};
const getTarget = () => document.getElementById("overview-toolbar");
const getServerTarget = () => null;

export function OverviewToolbar({ children }: { children: ReactNode }) {
  const target = useSyncExternalStore(subscribe, getTarget, getServerTarget);
  return target ? createPortal(children, target) : null;
}
