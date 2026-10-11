"use client";
import { ResponsiveDisclosure } from "./responsive-disclosure";
import { useSearchParams } from "next/navigation";
import { WorkspaceTabs, useWorkspaceTab } from "./workspace-tabs";
import type { Asset, LedgerEntry, ValuedPosition } from "@/domain/types";
import type { SavedExitPlan } from "@/domain/planning";
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
import {
  money,
  percentage,
  quantity,
  pnlClass,
  unitPrice,
} from "@/lib/formatters";
import { BalanceValue } from "./ui";
import { amount, decimal } from "@/domain/decimal";
import type { SaleResult } from "@/domain/ledger";
export function PositionWorkspace({
  position: p,
  portfolioId,
  portfolioValue,
  revision,
  assets,
  entries,
  sales,
  plan,
  journal,
}: {
  position: ValuedPosition;
  portfolioId: string;
  portfolioValue: string | null;
  revision: number;
  assets: Asset[];
  entries: LedgerEntry[];
  sales: Record<string, SaleResult>;
  plan: SavedExitPlan | null;
  journal: JournalData | null;
}) {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const [requested, setTab] = useWorkspaceTab(
    ["overview", "transactions", "plan", "dca", "exit", "journal"],
    "overview",
  );
  const tab = requested === "dca" || requested === "exit" ? "plan" : requested;
  const totalPnl =
    p.realizedPnl === null || p.unrealizedPnl === null
      ? null
      : amount(decimal(p.realizedPnl).plus(p.unrealizedPnl));
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
              <div
                className="stats mt-2 grid w-full grid-flow-row grid-cols-2 overflow-visible rounded-none border-t border-base-300 bg-transparent sm:grid-cols-3"
                aria-label="პოზიციის მოგება და ზარალი"
              >
                {[
                  ["დაფიქსირებული P/L", p.realizedPnl],
                  ["დარჩენილი პოზიციის P/L", p.unrealizedPnl],
                  ["სრული P/L", totalPnl],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="stat min-w-0 px-0 py-2 last:col-span-2 sm:px-3 sm:first:pl-0 sm:last:col-span-1 sm:last:pr-0"
                  >
                    <span className="stat-title whitespace-normal text-xs">
                      {label}
                    </span>
                    <span
                      className={`stat-value numeric mt-1 overflow-x-auto whitespace-nowrap text-lg ${pnlClass(value)}`}
                    >
                      <BalanceValue>{money(value)}</BalanceValue>
                    </span>
                  </div>
                ))}
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
          sales={sales}
          assets={assets}
          portfolioId={portfolioId}
          revision={revision}
        />
      )}
      {tab === "plan" && (
        <div className="grid items-start gap-3 lg:grid-cols-2">
          <ResponsiveDisclosure
            key={requested}
            open={requestedTab !== "exit"}
            className="collapse collapse-arrow border border-base-300 bg-base-200"
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
          </ResponsiveDisclosure>
          <ResponsiveDisclosure
            open={requestedTab === "exit"}
            className="collapse collapse-arrow border border-base-300 bg-base-200"
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
          </ResponsiveDisclosure>
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
