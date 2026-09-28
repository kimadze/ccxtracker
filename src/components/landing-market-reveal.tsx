"use client";

import { type PointerEvent, type ReactNode, useRef } from "react";

export function LandingMarketReveal({ children }: { children: ReactNode }) {
  const surface = useRef<HTMLElement>(null);

  function updatePointer(event: PointerEvent<HTMLElement>) {
    const element = surface.current;
    if (!element || event.pointerType === "touch") return;
    const bounds = element.getBoundingClientRect();
    element.style.setProperty("--reveal-x", `${event.clientX - bounds.left}px`);
    element.style.setProperty("--reveal-y", `${event.clientY - bounds.top}px`);
    element.dataset.revealing = "true";
  }

  function clearPointer() {
    if (surface.current) surface.current.dataset.revealing = "false";
  }

  return <section ref={surface} className="landing-hero landing-market-reveal" onPointerMove={updatePointer} onPointerLeave={clearPointer}>
    <MarketCandles />
    <div className="landing-market-reveal-content">{children}</div>
  </section>;
}

function MarketCandles() {
  const candles = [
    [92, 202, 164, 180], [116, 185, 142, 158], [140, 165, 121, 148], [164, 188, 212, 172],
    [188, 140, 165, 182], [212, 123, 151, 140], [236, 158, 137, 151], [260, 116, 143, 132],
    [284, 95, 126, 116], [308, 122, 153, 106], [332, 77, 108, 98], [356, 59, 89, 76],
    [380, 90, 118, 65], [404, 54, 82, 72], [428, 33, 67, 52], [452, 49, 78, 40],
  ];
  return <svg className="landing-market-reveal-chart" viewBox="0 0 560 260" preserveAspectRatio="none" aria-hidden="true">
    <g className="landing-market-grid">{[42, 84, 126, 168, 210].map((y) => <path key={y} d={`M0 ${y}H560`} />)}{[56, 112, 168, 224, 280, 336, 392, 448, 504].map((x) => <path key={x} d={`M${x} 0V260`} />)}</g>
    <polyline className="landing-market-line" points="76,198 104,170 132,182 160,144 188,161 216,127 244,147 272,111 300,91 328,121 356,72 384,91 412,51 440,63 468,36" />
    <g className="landing-market-candles">{candles.map(([x, high, low, close], index) => {
      const open = index ? candles[index - 1][3] : 190;
      const up = close >= open;
      return <g key={x} className={up ? "up" : "down"}><path d={`M${x} ${high}V${low}`} /><rect x={x - 4} y={Math.min(open, close)} width="8" height={Math.max(5, Math.abs(open - close))} rx="1" /></g>;
    })}</g>
  </svg>;
}
