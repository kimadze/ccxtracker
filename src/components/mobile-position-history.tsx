"use client";

import { useEffect, useId, useState } from "react";

export function MobilePositionHistory({ asset }: { asset: string }) {
  const gradient = useId();
  const [result, setResult] = useState<{ asset: string; prices: number[] }>();
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 767px)");
    let request: AbortController | undefined;
    const load = () => {
      request?.abort();
      if (!mobile.matches) return;
      const controller = new AbortController();
      request = controller;
      fetch("/api/position-history?asset=" + encodeURIComponent(asset), {
        signal: controller.signal,
      })
        .then((response) => response.ok ? response.json() : { prices: [] })
        .then(({ prices }: { prices: number[] }) => {
          if (!controller.signal.aborted) setResult({ asset, prices });
        })
        .catch(() => {
          if (!controller.signal.aborted) setResult({ asset, prices: [] });
        });
    };
    load();
    mobile.addEventListener("change", load);
    return () => {
      mobile.removeEventListener("change", load);
      request?.abort();
    };
  }, [asset]);

  const prices = result?.asset === asset ? result.prices : null;
  const low = prices?.length ? Math.min(...prices) : 0;
  const high = prices?.length ? Math.max(...prices) : 0;
  const points = prices?.map((price, index) => {
    const x = index * 360 / Math.max(1, prices.length - 1);
    const y = high === low ? 80 : 148 - (price - low) * 136 / (high - low);
    return x.toFixed(1) + "," + y.toFixed(1);
  }).join(" ");
  return (
    <figure className="ccx-mobile-price-chart md:hidden">
      <figcaption className="mb-2 text-xs text-base-content/65">ფასის ისტორია · 7 დღე</figcaption>
      {prices && prices.length > 1 ? (
        <svg viewBox="0 0 360 160" role="img" aria-label="ფასის ცვლილება ბოლო 7 დღეში" className="w-full">
          <defs>
            <linearGradient id={gradient} x2="0%" y2="100%">
              <stop stopColor="currentColor" stopOpacity=".28" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0 40H360 M0 80H360 M0 120H360" stroke="currentColor" strokeOpacity=".16" strokeDasharray="4 5" />
          <polygon points={"0,160 " + points + " 360,160"} fill={"url(#" + gradient + ")"} />
          <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
      ) : (
        <p role="status" className="py-4 text-xs text-base-content/65">
          {prices ? "ფასის ისტორია მიუწვდომელია." : "ფასის ისტორია იტვირთება…"}
        </p>
      )}
    </figure>
  );
}
