"use client";
import { useCallback, useEffect, useRef } from "react";

const drafts = new Set<{ dirty: boolean; generation: number }>();
function confirmDrafts(items: Iterable<{ dirty: boolean }>) {
  const affected = [...items];
  if (!affected.some((draft) => draft.dirty)) return true;
  if (!window.confirm("ცვლილებები შეუნახავია. გსურთ მათი დატოვება?"))
    return false;
  for (const draft of affected) draft.dirty = false;
  return true;
}
export function confirmDiscardChanges() {
  return confirmDrafts(drafts);
}

/** Shared guard for links, app selectors, tabs and document navigation. */
export function useUnsavedChanges(enabled = true) {
  const state = useRef({ dirty: false, generation: 0 });
  const markDirty = useCallback(() => {
    if (enabled) {
      state.current.dirty = true;
      state.current.generation++;
    }
  }, [enabled]);
  const clear = useCallback((generation?: number) => {
    if (generation === undefined || generation === state.current.generation)
      state.current.dirty = false;
  }, []);
  useEffect(() => {
    if (!enabled) return;
    const draft = state.current;
    drafts.add(draft);
    const unload = (event: BeforeUnloadEvent) => {
      if (![...drafts].some((item) => item.dirty)) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const click = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = (event.target as Element | null)?.closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download"))
        return;
      const next = new URL(link.href, location.href);
      if (next.protocol !== "http:" && next.protocol !== "https:") return;
      if (
        next.href === location.href ||
        (next.pathname === location.pathname &&
          next.search === location.search &&
          next.hash)
      )
        return;
      if (!confirmDiscardChanges()) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    // Navigation API also covers history traversal in supporting browsers.
    // beforeunload and explicit app guards remain the fallback elsewhere.
    const navigation = (window as Window & { navigation?: EventTarget })
      .navigation;
    const navigate = (event: Event) => {
      const detail = event as Event & {
        hashChange?: boolean;
        downloadRequest?: string | null;
      };
      if (
        event.defaultPrevented ||
        !event.cancelable ||
        detail.hashChange ||
        detail.downloadRequest
      )
        return;
      if (!confirmDiscardChanges()) event.preventDefault();
    };
    document.addEventListener("click", click, true);
    window.addEventListener("beforeunload", unload);
    navigation?.addEventListener("navigate", navigate);
    return () => {
      drafts.delete(draft);
      document.removeEventListener("click", click, true);
      window.removeEventListener("beforeunload", unload);
      navigation?.removeEventListener("navigate", navigate);
    };
  }, [enabled]);
  return {
    markDirty,
    clear,
    checkpoint: () => state.current.generation,
    confirmDiscard: () => confirmDrafts([state.current]),
  };
}
