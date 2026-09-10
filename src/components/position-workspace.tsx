"use client";
import { useState } from "react";
import type { Asset, LedgerEntry, ValuedPosition } from "@/domain/types";
import type { ExitLevel } from "@/domain/planning";
import { Metric } from "./overview";
import { DcaPlanner, ExitPlanner } from "./position-planners";
import { JournalForm, type JournalData } from "./journal";
import { TransactionList } from "./transaction-list";
import { money, percentage, quantity, pnlClass } from "@/lib/formatters";
export function PositionWorkspace({ position: p, portfolioId, portfolioValue, revision, assets, entries, plan, journal, attachments }: { position: ValuedPosition; portfolioId: string; portfolioValue: string | null; revision: number; assets: Asset[]; entries: LedgerEntry[]; plan: { feePercent: string; levels: ExitLevel[] } | null; journal: JournalData | null; attachments?: React.ReactNode }) {
  const [tab, setTab] = useState("overview");
  return <><div className="mb-6 flex flex-wrap gap-2 border-b border-line pb-4">{[["overview", "მიმოხილვა"], ["transactions", "ტრანზაქციები"], ["dca", "DCA"], ["exit", "გასვლის გეგმა"], ["journal", "ჟურნალი"]].map(([key, label]) => <button key={key} aria-pressed={tab === key} onClick={() => setTab(key)} className={`rounded-lg px-4 py-2.5 text-xs ${tab === key ? "bg-brand/10 text-brand" : "text-muted hover:bg-raised"}`}>{label}</button>)}</div>{tab === "overview" && <div className="panel grid grid-cols-2 gap-7 p-7 xl:grid-cols-4"><Metric label="რაოდენობა" value={quantity(p.quantity)} /><Metric label="მიმდინარე ღირებულება" value={money(p.value)} /><Metric label="საშუალო შესყიდვის ფასი" value={money(p.averagePrice)} /><Metric label="მოგება / ზარალი" value={money(p.unrealizedPnl)} tone={pnlClass(p.unrealizedPnl)} /><Metric label="თვითღირებულება" value={money(p.costBasis)} /><Metric label="მიმდინარე ფასი" value={money(p.quote?.price ?? null)} /><Metric label="შემოსავლიანობა" value={percentage(p.returnPercent)} /><Metric label="წილი პორტფელში" value={percentage(p.allocation)} /></div>}{tab === "transactions" && <TransactionList entries={entries} assets={assets} portfolioId={portfolioId} revision={revision} />}{tab === "dca" && <DcaPlanner position={p} portfolioValue={portfolioValue} />}{tab === "exit" && <ExitPlanner position={p} portfolioId={portfolioId} initial={plan} />}{tab === "journal" && <div className="space-y-6"><JournalForm portfolioId={portfolioId} assetId={p.assetId} initial={journal} />{attachments}</div>}</>;
}
