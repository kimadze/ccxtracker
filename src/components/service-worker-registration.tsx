"use client";

import { useEffect, useState } from "react";

export function ServiceWorkerRegistration() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(
    null,
  );

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let registrationCleanup: (() => void) | undefined;

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller)
          setWaitingWorker(registration.waiting);

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            )
              setWaitingWorker(registration.waiting ?? installing);
          });
        });

        const checkForUpdate = () => {
          if (document.visibilityState === "visible")
            void registration.update().catch(() => undefined);
        };
        window.addEventListener("focus", checkForUpdate);
        document.addEventListener("visibilitychange", checkForUpdate);
        const timer = window.setInterval(checkForUpdate, 60 * 60 * 1000);
        registrationCleanup = () => {
          window.removeEventListener("focus", checkForUpdate);
          document.removeEventListener("visibilitychange", checkForUpdate);
          window.clearInterval(timer);
        };
      })
      .catch(() => undefined);

    return () => {
      registrationCleanup?.();
    };
  }, []);

  if (!waitingWorker) return null;

  return (
    <div className="toast toast-top toast-end z-[70] pt-[env(safe-area-inset-top)]">
      <div
        role="status"
        className="alert alert-info alert-soft max-w-sm shadow-lg"
      >
        <span className="text-sm">CCX-ის ახალი ვერსია მზადაა.</span>
        <button
          className="btn btn-sm btn-primary min-h-11"
          onClick={() => {
            waitingWorker.postMessage({ type: "SKIP_WAITING" });
            navigator.serviceWorker.addEventListener(
              "controllerchange",
              () => window.location.reload(),
              { once: true },
            );
          }}
        >
          განახლება
        </button>
      </div>
    </div>
  );
}
