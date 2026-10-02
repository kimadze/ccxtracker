"use client";

import { useSyncExternalStore } from "react";

export const privacyEvent = "ccx-balance-privacy";
export const subscribePrivacy = (callback: () => void) => {
  window.addEventListener(privacyEvent, callback);
  return () => window.removeEventListener(privacyEvent, callback);
};
export const readPrivacy = () =>
  window.localStorage.getItem("ccx-hide-balances") === "true";
export const serverPrivacy = () => false;

export function useBalancesHidden() {
  return useSyncExternalStore(subscribePrivacy, readPrivacy, serverPrivacy);
}
