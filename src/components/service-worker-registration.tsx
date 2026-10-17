"use client";

import { useEffect, useState } from "react";
import { confirmDiscardChanges } from "./unsaved-changes";

export function ServiceWorkerRegistration() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(
    null,
  );
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let disposed = false;
    let registrationCleanup: (() => void) | undefined;
    const workerCleanups: (() => void)[] = [];

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((registration) => {
        if (disposed) return;
        if (registration.waiting && navigator.serviceWorker.controller)
          setWaitingWorker(registration.waiting);

        const onUpdateFound = () => {
          const installing = registration.installing;
          if (!installing) return;
          const onStateChange = () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            )
              setWaitingWorker(registration.waiting ?? installing);
          };
          installing.addEventListener("statechange", onStateChange);
          workerCleanups.push(() =>
            installing.removeEventListener("statechange", onStateChange),
          );
        };
        registration.addEventListener("updatefound", onUpdateFound);

        const checkForUpdate = () => {
          if (document.visibilityState === "visible")
            void registration.update().catch(() => undefined);
        };
        window.addEventListener("focus", checkForUpdate);
        document.addEventListener("visibilitychange", checkForUpdate);
        const timer = window.setInterval(checkForUpdate, 60 * 60 * 1000);
        registrationCleanup = () => {
          registration.removeEventListener("updatefound", onUpdateFound);
          window.removeEventListener("focus", checkForUpdate);
          document.removeEventListener("visibilitychange", checkForUpdate);
          window.clearInterval(timer);
        };
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      registrationCleanup?.();
      workerCleanups.forEach((cleanup) => cleanup());
    };
  }, []);

  if (!waitingWorker) return null;

  return (
    <div className="toast toast-top toast-end z-[70] w-full max-w-sm pt-[env(safe-area-inset-top)]">
      <div
        role="status"
        className="alert alert-info alert-soft w-full min-w-0 shadow-lg"
      >
        <span className="text-sm">CCX-ის ახალი ვერსია მზადაა.</span>
        <button
          type="button"
          className="btn btn-sm btn-primary min-h-11"
          onClick={() => {
            if (updating || !confirmDiscardChanges()) return;
            setUpdating(true);
            navigator.serviceWorker.addEventListener(
              "controllerchange",
              () => window.location.reload(),
              { once: true },
            );
            waitingWorker.postMessage({ type: "SKIP_WAITING" });
          }}
          disabled={updating}
        >
          {updating ? "ახლდება…" : "განახლება"}
        </button>
      </div>
    </div>
  );
}
