"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { highResLogoUrl } from "@/lib/asset-logo";
import type { ValuedPosition } from "@/domain/types";
import { money, percentage, pnlClass } from "@/lib/formatters";
import { AssetIcon } from "./positions";

function tone(position: ValuedPosition) {
  const value = Number(position.quote?.change24h ?? 0);
  return value > 0 ? "positive" : value < 0 ? "negative" : "neutral";
}

export function PortfolioBubbleMap({ positions, portfolioId }: { positions: ValuedPosition[]; portfolioId: string }) {
  const crypto = useMemo(
    () => positions.filter((position) => !position.asset.isStablecoin && Number(position.value ?? 0) > 0).sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0)),
    [positions],
  );
  const total = crypto.reduce((sum, position) => sum + Number(position.value ?? 0), 0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = crypto.find((position) => position.assetId === selectedId) ?? crypto[0];

  if (!crypto.length)
    return <section className="card panel bubble-map-empty"><h2>პოზიციების განაწილება</h2><p>ამ ხედისთვის საჭიროა მინიმუმ ერთი შეფასებული არასტეიბლ კრიპტოაქტივი.</p></section>;

  return <div className="allocation-map-space">
    <section className="card panel allocation-map-panel" aria-labelledby="allocation-map-heading">
      <header className="allocation-map-header">
        <div><p className="allocation-kicker">პორტფელის კონცენტრაცია</p><h2 id="allocation-map-heading">აქტივების განაწილება</h2><p>წილი, ღირებულება და დღიური მოძრაობა ერთ სამუშაო სიაში.</p></div>
        <div className="allocation-map-total"><small>არასტეიბლ კრიპტო</small><strong>{money(String(total))}</strong></div>
      </header>
      <div className="allocation-map-columns" aria-hidden="true"><span>აქტივი</span><span>ღირებულება / წილი</span><span>24 საათი</span></div>
      <div className="allocation-map-list">
        {crypto.map((position, index) => {
          const share = total ? (Number(position.value ?? 0) / total) * 100 : 0;
          const active = selected?.assetId === position.assetId;
          return <button key={position.assetId} className={`allocation-map-row ${active ? "active" : ""}`} type="button" onClick={() => setSelectedId(position.assetId)}>
            <span className="allocation-map-asset"><AssetIcon symbol={position.asset.symbol} logoUrl={position.asset.logoUrl} index={index} /><span><strong>{position.asset.symbol}</strong><small>{position.asset.name}</small></span></span>
            <span className="allocation-map-weight"><strong>{money(position.value)}</strong><small>{percentage(String(share))}</small><i><b style={{ width: `${share}%` }} /></i></span>
            <span className={`allocation-map-change ${pnlClass(position.quote?.change24h ?? null)}`}>{percentage(position.quote?.change24h ?? null, true)}</span>
          </button>;
        })}
      </div>
    </section>
    {selected && <section className="card panel allocation-map-selection" aria-live="polite">
      <div className={`allocation-map-mark ${tone(selected)}`}>{selected.asset.logoUrl ? <Image src={highResLogoUrl(selected.asset.logoUrl) ?? selected.asset.logoUrl} alt="" width={40} height={40} unoptimized /> : selected.asset.symbol.slice(0, 3)}</div>
      <div><p className="allocation-kicker">არჩეული აქტივი</p><h2>{selected.asset.name} <span>{selected.asset.symbol}</span></h2></div>
      <dl><div><dt>ღირებულება</dt><dd>{money(selected.value)}</dd></div><div><dt>24 საათი</dt><dd className={pnlClass(selected.quote?.change24h ?? null)}>{percentage(selected.quote?.change24h ?? null, true)}</dd></div><div><dt>სრული შედეგი</dt><dd className={pnlClass(selected.returnPercent)}>{percentage(selected.returnPercent, true)}</dd></div></dl>
      <Link className="allocation-map-detail-link" href={`/portfolios/${portfolioId}/positions/${selected.assetId}`}>პოზიციის მართვა <ArrowUpRight size={14} /></Link>
    </section>}
  </div>;
}
