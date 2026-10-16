"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Refresh server-rendered valuations without resetting an open form or dialog.
export function useMarketRefresh(path: string) {
  const router = useRouter();
  useEffect(() => {
    let lastRefresh = Date.now();
    const refresh = () => {
      if (
        document.hidden ||
        Date.now() - lastRefresh < 60000 ||
        document.querySelector("dialog[open]") ||
        document.activeElement?.matches(
          "input, textarea, select, [contenteditable=true]",
        )
      )
        return;
      lastRefresh = Date.now();
      router.refresh();
    };
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [path, router]);
}
