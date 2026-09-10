"use client";
import { useState } from "react";
import type { PortfolioSummary } from "@/domain/types";
import type { ExitLevel } from "@/domain/planning";
import { DcaPlanner, ExitPlanner } from "./position-planners";
import { JournalForm, type JournalData } from "./journal";
export function StrategyWorkspace({ summary, portfolioId, data, mode = "strategy", preview = false }: { summary: PortfolioSummary; portfolioId: string; data: Record<string, { plan: { feePercent: string; levels: ExitLevel[] } | null; journal: JournalData | null }>; mode?: "strategy" | "journal"; preview?: boolean }) {
  const [assetId, setAssetId] = useState(summary.positions[0]?.assetId ?? ""), [tab, setTab] = useState("exit");
  const p = summary.positions.find(p => p.assetId === assetId);
  if (!p) return <div className="panel p-10 text-center text-sm text-muted">ჯერ დაამატეთ პოზიცია.</div>;
  return <div className="space-y-6"><div className="flex flex-wrap items-center gap-3"><select className="max-w-xs" aria-label="პოზიციის არჩევა" value={assetId} onChange={e => setAssetId(e.target.value)}>{summary.positions.map(p => <option key={p.assetId} value={p.assetId}>{p.asset.name} · {p.asset.symbol}</option>)}</select>{mode === "strategy" && <><button className={tab === "exit" ? "button-primary" : "button-secondary"} onClick={() => setTab("exit")}>გასვლის გეგმა</button><button className={tab === "dca" ? "button-primary" : "button-secondary"} onClick={() => setTab("dca")}>DCA</button></>}</div>{mode === "journal" ? <JournalForm key={assetId} portfolioId={portfolioId} assetId={assetId} initial={data[assetId]?.journal} preview={preview} /> : tab === "exit" ? <ExitPlanner key={assetId} position={p} portfolioId={portfolioId} initial={data[assetId]?.plan} preview={preview} /> : <DcaPlanner key={assetId} position={p} portfolioValue={summary.value} />}</div>;
}
