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
    <span className="landing-market-cursor" aria-hidden="true" />
    <div className="landing-market-reveal-content">{children}</div>
  </section>;
}

function MarketCandles() {
  const candles = [
    [26, 220, 180, 204], [46, 211, 174, 185], [66, 194, 154, 166], [86, 184, 146, 174],
    [106, 179, 134, 142], [126, 157, 121, 148], [146, 164, 128, 135], [166, 145, 107, 114],
    [186, 130, 96, 103], [206, 119, 78, 87], [226, 104, 66, 75], [246, 91, 55, 62],
    [266, 76, 42, 50], [286, 69, 34, 42], [306, 60, 26, 32], [326, 74, 38, 58],
    [346, 64, 28, 36], [366, 50, 18, 26], [386, 57, 24, 46], [406, 48, 13, 21],
    [426, 40, 10, 17], [446, 36, 8, 14], [466, 44, 12, 32], [486, 31, 5, 11],
    [506, 28, 3, 8],
  ];
  return <svg className="landing-market-reveal-chart" viewBox="0 0 560 260" preserveAspectRatio="none" aria-hidden="true">
    <g className="landing-market-grid">{[42, 84, 126, 168, 210].map((y) => <path key={y} d={`M0 ${y}H560`} />)}{[56, 112, 168, 224, 280, 336, 392, 448, 504].map((x) => <path key={x} d={`M${x} 0V260`} />)}</g>
    <polyline className="landing-market-line" points="18,204 42,185 62,166 82,174 102,142 122,148 142,135 162,114 182,103 202,87 222,75 242,62 262,50 282,42 302,32 322,58 342,36 362,26 382,46 402,21 422,17 442,14 462,32 482,11 502,8" />
    <g className="landing-market-candles">{candles.map(([x, high, low, close], index) => {
      const open = index ? candles[index - 1][3] : 190;
      const up = close >= open;
      return <g key={x} className={up ? "up" : "down"}><path d={`M${x} ${high}V${low}`} /><rect x={x - 4} y={Math.min(open, close)} width="8" height={Math.max(5, Math.abs(open - close))} rx="1" /></g>;
    })}</g>
  </svg>;
}
