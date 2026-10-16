"use client";

import { useSyncExternalStore } from "react";

export const privacyEvent = "ccx-balance-privacy";
const storageKey = "ccx-hide-balances";
let fallbackHidden = true;
export const subscribePrivacy = (callback: () => void) => {
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === null) callback();
  };
  window.addEventListener(privacyEvent, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(privacyEvent, callback);
    window.removeEventListener("storage", onStorage);
  };
};
export const readPrivacy = () => {
  try {
    fallbackHidden = window.localStorage.getItem(storageKey) === "true";
  } catch {
    // Keep balances hidden if browser storage is unavailable on first load.
  }
  return fallbackHidden;
};
export const writePrivacy = (hidden: boolean) => {
  fallbackHidden = hidden;
  try {
    window.localStorage.setItem(storageKey, String(hidden));
  } catch {
    // The current tab still supports privacy when persistence is unavailable.
  }
  window.dispatchEvent(new Event(privacyEvent));
};
// Hide server-rendered amounts until the browser preference is available.
export const serverPrivacy = () => true;

export function useBalancesHidden() {
  return useSyncExternalStore(subscribePrivacy, readPrivacy, serverPrivacy);
}
