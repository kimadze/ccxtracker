"use client";
import { useSyncExternalStore } from "react";
import { walletSnapshotStale, type WalletSnapshot } from "@/domain/wallet";

const subscribe = (changed: () => void) => {
  const timer = window.setInterval(changed, 30000);
  window.addEventListener("focus", changed);
  document.addEventListener("visibilitychange", changed);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener("focus", changed);
    document.removeEventListener("visibilitychange", changed);
  };
};
const currentTime = () => Math.floor(Date.now() / 30000) * 30000;
const serverTime = () => 0;
export function useWalletFreshness(snapshot: WalletSnapshot | null) {
  const now = useSyncExternalStore(subscribe, currentTime, serverTime);
  // Initial server output is conservative until the browser clock is available.
  return !!snapshot && (!now || walletSnapshotStale(snapshot, now));
}
