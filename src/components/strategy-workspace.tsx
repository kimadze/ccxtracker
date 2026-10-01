"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Asset, PortfolioSummary } from "@/domain/types";
import type { ExitLevel } from "@/domain/planning";
import { DcaPlanner, ExitPlanner } from "./position-planners";
import { JournalForm, type JournalData } from "./journal";
import {
  investablePositions,
  investableValue,
} from "@/domain/portfolio-segments";
export function StrategyWorkspace({
  summary,
  portfolioId,
  data,
  mode = "strategy",
  preview = false,
  journalAssets = [],
}: {
  summary: PortfolioSummary;
  portfolioId: string;
  data: Record<
    string,
    {
      plan: { feePercent: string; levels: ExitLevel[] } | null;
      journal: (JournalData & { id?: string }) | null;
    }
  >;
  mode?: "strategy" | "journal";
  preview?: boolean;
  journalAssets?: Asset[];
}) {
  const options = [
    ...new Map(
      [
        ...investablePositions(summary).map((p) => p.asset),
        ...(mode === "journal" ? journalAssets : []),
      ].map((asset) => [asset.id, asset]),
    ).values(),
  ];
  const searchParams = useSearchParams();
  const requestedAssetId = searchParams.get("asset");
  const [assetId, setAssetId] = useState(() =>
    options.some((asset) => asset.id === requestedAssetId)
      ? requestedAssetId!
      : (options[0]?.id ?? ""),
  );
  const p = investablePositions(summary).find((p) => p.assetId === assetId);
  if (!options.length || (mode !== "journal" && !p))
    return (
      <div role="alert" className="alert alert-info alert-soft justify-center p-10 text-sm">
        ჯერ დაამატეთ პოზიცია.
      </div>
    );
  return (
    <div className="space-y-6">
      <div className="card card-border bg-base-200 p-4">
        <select
          className="select w-full sm:max-w-xs"
          aria-label="პოზიციის არჩევა"
          value={assetId}
          onChange={(e) => setAssetId(e.target.value)}
        >
          {options.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.name} · {asset.symbol}
            </option>
          ))}
        </select>
      </div>
      {mode === "journal" ? (
        <div className="space-y-6">
          <JournalForm
            key={assetId}
            portfolioId={portfolioId}
            assetId={assetId}
            initial={data[assetId]?.journal}
            preview={preview}
          />
        </div>
      ) : (
        <div className="space-y-6">
          <section className="card card-border bg-base-200"><div className="card-body">
            <div>
              <h2 className="card-title text-base">შესვლის გეგმა</h2>
              <p className="mt-1 text-sm text-base-content/60">
                DCA განაწილება მიმდინარე პოზიციისა და პორტფელის ზომის მიხედვით.
              </p>
            </div>
            <DcaPlanner
              key={`${assetId}-dca`}
              position={p!}
              portfolioValue={investableValue(summary)}
            />
          </div></section>
          <section className="card card-border bg-base-200"><div className="card-body">
            <div>
              <h2 className="card-title text-base">გასვლის გეგმა</h2>
              <p className="mt-1 text-sm text-base-content/60">სამიზნე ფასები და გასაყიდი წილები.</p>
            </div>
            <ExitPlanner
              key={`${assetId}-exit`}
              position={p!}
              portfolioId={portfolioId}
              initial={data[assetId]?.plan}
              preview={preview}
            />
          </div></section>
        </div>
      )}
    </div>
  );
}
