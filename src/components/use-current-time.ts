"use client";
import { useSyncExternalStore } from "react";
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
export function useCurrentTime() {
  return useSyncExternalStore(subscribe, currentTime, serverTime);
}
