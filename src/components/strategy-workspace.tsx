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
      <div className="card panel p-10 text-center text-sm text-muted">
        ჯერ დაამატეთ პოზიცია.
      </div>
    );
  return (
    <div className="strategy-workspace space-y-6">
      <div className="strategy-toolbar">
        <select
          className="max-w-xs"
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
        <div className="strategy-plan-stack space-y-6">
          <section>
            <div className="strategy-plan-heading">
              <span>შესვლის გეგმა</span>
              <p>
                DCA განაწილება მიმდინარე პოზიციისა და პორტფელის ზომის მიხედვით.
              </p>
            </div>
            <DcaPlanner
              key={`${assetId}-dca`}
              position={p!}
              portfolioValue={investableValue(summary)}
            />
          </section>
          <section>
            <div className="strategy-plan-heading">
              <span>გასვლის გეგმა</span>
              <p>სამიზნე ფასები და გასაყიდი წილები.</p>
            </div>
            <ExitPlanner
              key={`${assetId}-exit`}
              position={p!}
              portfolioId={portfolioId}
              initial={data[assetId]?.plan}
              preview={preview}
            />
          </section>
        </div>
      )}
    </div>
  );
}
