"use client";

import { useMemo, useState } from "react";
import type { ValuedPosition } from "@/domain/types";
import { money, percentage } from "@/lib/formatters";

export function PortfolioCalculator({ positions }: { positions: ValuedPosition[] }) {
  const [assetId, setAssetId] = useState(positions[0]?.assetId ?? "");
  const position = positions.find((item) => item.assetId === assetId) ?? positions[0];
  const [target, setTarget] = useState(position?.quote?.price ?? "0");
  const result = useMemo(() => {
    if (!position?.costBasis) return null;
    return Number(target || 0) * Number(position.quantity) - Number(position.costBasis);
  }, [position, target]);
  const resultPercent = position?.costBasis && result !== null
    ? (result / Number(position.costBasis)) * 100
    : null;

  if (!position) return null;
  return (
    <section className="panel dashboard-calculator p-4">
      <h2 className="text-[15px] font-semibold">პოტენციური P/L</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <label className="text-[10px] text-muted">აირჩიეთ აქტივი
          <select className="mt-1.5" value={position.assetId} onChange={(event) => {
            setAssetId(event.target.value);
            const next = positions.find((item) => item.assetId === event.target.value);
            setTarget(next?.quote?.price ?? "0");
          }}>
            {positions.map((item) => <option key={item.assetId} value={item.assetId}>{item.asset.symbol}</option>)}
          </select>
        </label>
        <label className="text-[10px] text-muted">სამიზნე ფასი
          <input className="numeric mt-1.5" type="number" min="0" step="any" value={target} onChange={(event) => setTarget(event.target.value)} />
        </label>
      </div>
      <div className="mt-3 rounded-lg border border-positive/20 bg-positive/8 p-4">
        <p className="text-[10px] text-muted">პოტენციური მოგება / ზარალი</p>
        <div className="mt-1 flex items-end justify-between gap-3 text-positive">
          <strong className="numeric text-xl">{result === null ? "—" : money(String(result))}</strong>
          <span className="numeric text-sm">{resultPercent === null ? "—" : percentage(String(resultPercent), true)}</span>
        </div>
      </div>
      <p className="mt-3 text-[9px] leading-4 text-muted">სავარაუდო შედეგი მომავალი საკომისიოს გარეშე.</p>
    </section>
  );
}
