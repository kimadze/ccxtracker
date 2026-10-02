"use client";
import { useSearchParams } from "next/navigation";
import { WorkspaceTabs, useWorkspaceTab } from "./workspace-tabs";
import type { Asset, LedgerEntry, ValuedPosition } from "@/domain/types";
import type { ExitLevel } from "@/domain/planning";
import { Metric } from "./overview";
import dynamic from "next/dynamic";
const DcaPlanner = dynamic(() =>
  import("./position-planners").then((m) => m.DcaPlanner),
);
const ExitPlanner = dynamic(() =>
  import("./position-planners").then((m) => m.ExitPlanner),
);
import { JournalForm, type JournalData } from "./journal";
import { TransactionList } from "./transaction-list";
import { money, percentage, quantity, pnlClass, unitPrice } from "@/lib/formatters";
import { BalanceValue } from "./ui";
export function PositionWorkspace({
  position: p,
  portfolioId,
  portfolioValue,
  revision,
  assets,
  entries,
  plan,
  journal,
}: {
  position: ValuedPosition;
  portfolioId: string;
  portfolioValue: string | null;
  revision: number;
  assets: Asset[];
  entries: LedgerEntry[];
  plan: { feePercent: string; levels: ExitLevel[] } | null;
  journal: JournalData | null;
}) {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const [requested, setTab] = useWorkspaceTab(
    ["overview", "transactions", "plan", "dca", "exit", "journal"],
    "overview",
  );
  const tab = requested === "dca" || requested === "exit" ? "plan" : requested;
  return (
    <WorkspaceTabs
      label="პოზიციის სექციები"
      value={tab}
      onChange={setTab}
      items={[
        ["overview", "მიმოხილვა"],
        ["transactions", "ტრანზაქციები"],
        ["plan", "გეგმა"],
        ["journal", "ჟურნალი"],
      ]}
    >
      {tab === "overview" && (
        <div className="space-y-3">
          <div className="card border border-base-300 bg-base-200">
            <div className="card-body gap-2 p-4 lg:p-5">
              <p className="text-xs text-base-content/60">
                მიმდინარე ღირებულება
              </p>
              <p className="overflow-x-auto whitespace-nowrap text-3xl font-semibold tracking-tight tabular-nums lg:text-4xl">
                <BalanceValue>{money(p.value)}</BalanceValue>
              </p>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm tabular-nums">
                <span className="text-xs text-base-content/60">
                  მოგება / ზარალი
                </span>
                <span className={pnlClass(p.unrealizedPnl)}>
                  <BalanceValue>{money(p.unrealizedPnl)}</BalanceValue>
                </span>
                <span className={pnlClass(p.returnPercent)}>
                  {percentage(p.returnPercent, true)}
                </span>
              </div>
            </div>
          </div>
          <div className="grid min-w-0 grid-cols-2 gap-0 rounded-box border border-base-300 bg-base-200 p-1 lg:grid-cols-3">
            <Metric label="რაოდენობა" value={quantity(p.quantity)} sensitive />
            <Metric
              label="საშუალო შესყიდვის ფასი"
              value={unitPrice(p.averagePrice)}
              sensitive
            />
            <Metric
              label="თვითღირებულება"
              value={money(p.costBasis)}
              sensitive
            />
            <Metric
              label="მიმდინარე ფასი"
              value={unitPrice(p.quote?.price ?? null)}
            />
            <Metric
              label="შემოსავლიანობა"
              value={percentage(p.returnPercent)}
            />
            <Metric label="წილი პორტფელში" value={percentage(p.allocation)} />
          </div>
        </div>
      )}
      {tab === "transactions" && (
        <TransactionList
          entries={entries}
          assets={assets}
          portfolioId={portfolioId}
          revision={revision}
        />
      )}
      {tab === "plan" && (
        <div className="grid items-start gap-3 lg:grid-cols-2">
          <details
            key={requested}
            open={requestedTab !== "exit"}
            className="collapse collapse-arrow border border-base-300 bg-base-200 lg:collapse-open"
          >
            <summary className="collapse-title min-h-11 text-sm font-semibold">
              შესვლის გეგმა
            </summary>
            <div className="collapse-content">
              <DcaPlanner
                position={p}
                portfolioValue={portfolioValue}
                execution={{ portfolioId, revision, assets }}
              />
            </div>
          </details>
          <details
            open={requestedTab === "exit"}
            className="collapse collapse-arrow border border-base-300 bg-base-200 lg:collapse-open"
          >
            <summary className="collapse-title min-h-11 text-sm font-semibold">
              გასვლის გეგმა
            </summary>
            <div className="collapse-content">
              <ExitPlanner
                position={p}
                portfolioId={portfolioId}
                initial={plan}
              />
            </div>
          </details>
        </div>
      )}
      {tab === "journal" && (
        <div className="space-y-6">
          <JournalForm
            portfolioId={portfolioId}
            assetId={p.assetId}
            initial={journal}
          />
        </div>
      )}
    </WorkspaceTabs>
  );
}
