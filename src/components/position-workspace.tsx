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
import { money, percentage, quantity, pnlClass } from "@/lib/formatters";
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
          <div className="grid grid-cols-2 gap-3 rounded-box border border-base-300 bg-base-200 p-3">
            <Metric
              label="მიმდინარე ღირებულება"
              value={money(p.value)}
              sensitive
            />
            <Metric
              label="მოგება / ზარალი"
              value={money(p.unrealizedPnl)}
              tone={pnlClass(p.unrealizedPnl)}
              sensitive
            />
          </div>
          <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-3">
            <Metric label="რაოდენობა" value={quantity(p.quantity)} />
            <Metric
              label="საშუალო შესყიდვის ფასი"
              value={money(p.averagePrice)}
            />
            <Metric
              label="თვითღირებულება"
              value={money(p.costBasis)}
              sensitive
            />
            <Metric
              label="მიმდინარე ფასი"
              value={money(p.quote?.price ?? null)}
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
