"use client";
import { useState } from "react";
import type { Asset, PortfolioSummary } from "@/domain/types";
import type { ExitLevel } from "@/domain/planning";
import { DcaPlanner, ExitPlanner } from "./position-planners";
import { JournalForm, type JournalData } from "./journal";
import { Attachments } from "./attachments";
export function StrategyWorkspace({
  summary,
  portfolioId,
  data,
  mode = "strategy",
  preview = false,
  journalAssets = [],
  attachmentsEnabled = false,
}: {
  summary: PortfolioSummary;
  portfolioId: string;
  data: Record<
    string,
    {
      plan: { feePercent: string; levels: ExitLevel[] } | null;
      journal: (JournalData & { id?: string }) | null;
      files?: { id: string; name: string; size: number }[];
    }
  >;
  mode?: "strategy" | "journal";
  preview?: boolean;
  journalAssets?: Asset[];
  attachmentsEnabled?: boolean;
}) {
  const options = [
    ...new Map(
      [
        ...summary.positions.map((p) => p.asset),
        ...(mode === "journal" ? journalAssets : []),
      ].map((asset) => [asset.id, asset]),
    ).values(),
  ];
  const [assetId, setAssetId] = useState(options[0]?.id ?? ""),
    [tab, setTab] = useState("exit");
  const p = summary.positions.find((p) => p.assetId === assetId);
  if (!options.length || (mode !== "journal" && !p))
    return (
      <div className="panel p-10 text-center text-sm text-muted">
        ჯერ დაამატეთ პოზიცია.
      </div>
    );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
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
        {mode === "strategy" && (
          <>
            <button
              className={tab === "exit" ? "button-primary" : "button-secondary"}
              onClick={() => setTab("exit")}
            >
              გასვლის გეგმა
            </button>
            <button
              className={tab === "dca" ? "button-primary" : "button-secondary"}
              onClick={() => setTab("dca")}
            >
              DCA
            </button>
          </>
        )}
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
          {!preview && (
            <Attachments
              key={`files-${assetId}`}
              portfolioId={portfolioId}
              journalId={data[assetId]?.journal?.id ?? null}
              files={data[assetId]?.files ?? []}
              enabled={attachmentsEnabled}
            />
          )}
        </div>
      ) : tab === "exit" ? (
        <ExitPlanner
          key={assetId}
          position={p!}
          portfolioId={portfolioId}
          initial={data[assetId]?.plan}
          preview={preview}
        />
      ) : (
        <DcaPlanner
          key={assetId}
          position={p!}
          portfolioValue={summary.value}
        />
      )}
    </div>
  );
}
