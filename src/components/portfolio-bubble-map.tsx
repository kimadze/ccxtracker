"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import type { ValuedPosition } from "@/domain/types";
import { percentage, pnlClass } from "@/lib/formatters";

type Bubble = {
  position: ValuedPosition;
  share: number;
  x: number;
  y: number;
  radius: number;
};

const canvas = { width: 1000, height: 580 };

function packBubbles(positions: ValuedPosition[]): Bubble[] {
  const total = positions.reduce((sum, position) => sum + Number(position.value ?? 0), 0);
  const placed: Bubble[] = [];
  [...positions]
    .sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0))
    .forEach((position, index) => {
      const share = total ? (Number(position.value ?? 0) / total) * 100 : 0;
      const radius = Math.max(43, Math.min(116, 38 + Math.sqrt(share) * 12));
      let x = canvas.width / 2;
      let y = canvas.height / 2;
      if (index) {
        for (let step = 0; step < 1800; step += 1) {
          const angle = step * 2.399963229728653;
          const distance = 36 + Math.sqrt(step) * 13;
          const candidateX = Math.max(radius + 16, Math.min(canvas.width - radius - 16, canvas.width / 2 + Math.cos(angle) * distance));
          const candidateY = Math.max(radius + 16, Math.min(canvas.height - radius - 16, canvas.height / 2 + Math.sin(angle) * distance * 0.68));
          if (placed.every((bubble) => Math.hypot(candidateX - bubble.x, candidateY - bubble.y) >= radius + bubble.radius + 12)) {
            x = candidateX;
            y = candidateY;
            break;
          }
        }
      }
      placed.push({ position, share, x, y, radius });
    });
  return placed;
}

function tone(position: ValuedPosition) {
  const value = Number(position.quote?.change24h ?? 0);
  return value > 0 ? "positive" : value < 0 ? "negative" : "neutral";
}

export function PortfolioBubbleMap({ positions }: { positions: ValuedPosition[] }) {
  const crypto = positions.filter((position) => !position.asset.isStablecoin && Number(position.value ?? 0) > 0);
  const bubbles = useMemo(() => packBubbles(crypto), [crypto]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = bubbles.find((bubble) => bubble.position.assetId === selectedId) ?? bubbles[0];

  if (!crypto.length) return <section className="panel bubble-map-empty"><h2>Bubble Map</h2><p>რუკის სანახავად საჭიროა მინიმუმ ერთი შეფასებული არასტეიბლ კრიპტოაქტივი.</p></section>;

  return <div className="bubble-map-space">
    <section className="panel bubble-map-panel" aria-labelledby="bubble-map-heading">
      <header className="bubble-map-header">
        <div><h2 id="bubble-map-heading">პოზიციების Bubble Map</h2><p>ბუშტის ზომა ასახავს წილს თქვენს კრიპტო ნაწილში; ფერი — 24 საათის ცვლილებას.</p></div>
        <div className="bubble-map-legend" aria-label="ფერების განმარტება"><span><i className="positive" />ზრდა</span><span><i className="negative" />ვარდნა</span><span><i className="neutral" />უცვლელი</span></div>
      </header>
      <div className="bubble-map-canvas">
        <svg viewBox={`0 0 ${canvas.width} ${canvas.height}`} role="img" aria-label="თქვენი კრიპტო პოზიციების Bubble Map">
          <defs>
            <pattern id="bubble-grid" width="42" height="42" patternUnits="userSpaceOnUse"><path d="M 42 0 L 0 0 0 42" fill="none" stroke="var(--border)" strokeOpacity=".42" strokeWidth="1" /></pattern>
          </defs>
          <rect width={canvas.width} height={canvas.height} fill="url(#bubble-grid)" />
          {bubbles.map((bubble) => {
            const active = selected?.position.assetId === bubble.position.assetId;
            const currentTone = tone(bubble.position);
            return <g
              key={bubble.position.assetId}
              className={`bubble-map-node bubble-map-${currentTone} ${active ? "active" : ""}`}
              tabIndex={0}
              role="button"
              aria-label={`${bubble.position.asset.name}, კრიპტო ნაწილის ${percentage(String(bubble.share))}`}
              onClick={() => setSelectedId(bubble.position.assetId)}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(bubble.position.assetId); } }}
            >
              <circle cx={bubble.x} cy={bubble.y} r={bubble.radius} />
              {bubble.position.asset.logoUrl && <image href={bubble.position.asset.logoUrl} x={bubble.x - 18} y={bubble.y - 35} width="36" height="36" preserveAspectRatio="xMidYMid meet" />}
              <text x={bubble.x} y={bubble.y + (bubble.position.asset.logoUrl ? 20 : -3)} textAnchor="middle" className="bubble-map-symbol">{bubble.position.asset.symbol}</text>
              <text x={bubble.x} y={bubble.y + (bubble.position.asset.logoUrl ? 40 : 18)} textAnchor="middle" className="bubble-map-share">{percentage(String(bubble.share))}</text>
              <title>{`${bubble.position.asset.name} · ${percentage(String(bubble.share))}`}</title>
            </g>;
          })}
        </svg>
      </div>
    </section>
    {selected && <section className="panel bubble-map-selection" aria-live="polite">
      <div className={`bubble-map-selection-mark ${tone(selected.position)}`}>{selected.position.asset.logoUrl ? <Image src={selected.position.asset.logoUrl} alt="" width={44} height={44} unoptimized /> : selected.position.asset.symbol.slice(0, 3)}</div>
      <div><p className="eyebrow">არჩეული აქტივი</p><h2>{selected.position.asset.name} <span>{selected.position.asset.symbol}</span></h2></div>
      <dl>
        <div><dt>კრიპტო ნაწილის წილი</dt><dd>{percentage(String(selected.share))}</dd></div>
        <div><dt>24 საათი</dt><dd className={pnlClass(selected.position.quote?.change24h ?? null)}>{percentage(selected.position.quote?.change24h ?? null, true)}</dd></div>
        <div><dt>მთლიანი შემოსავლიანობა</dt><dd className={pnlClass(selected.position.returnPercent)}>{percentage(selected.position.returnPercent, true)}</dd></div>
      </dl>
    </section>}
  </div>;
}
