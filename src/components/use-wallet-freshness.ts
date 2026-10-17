"use client";
import { useCurrentTime } from "./use-current-time";
import { walletSnapshotStale, type WalletSnapshot } from "@/domain/wallet";

export function useWalletFreshness(snapshot: WalletSnapshot | null) {
  const now = useCurrentTime();
  // Initial server output is conservative until the browser clock is available.
  return !!snapshot && (!now || walletSnapshotStale(snapshot, now));
}
