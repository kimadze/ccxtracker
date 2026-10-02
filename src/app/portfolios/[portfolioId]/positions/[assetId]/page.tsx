import { notFound } from "next/navigation";
import { loadWorkspace } from "@/server/workspace";
import { PageHeading } from "@/components/shell";
import { PositionWorkspace } from "@/components/position-workspace";
import { strategyService } from "@/server/services/strategy";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { TransactionForm } from "@/components/transaction-form";
import { DeletePosition } from "@/components/delete-position";
import { AssetIcon } from "@/components/positions";
import { PositionShare } from "@/components/position-share";
import { MoreHorizontal } from "lucide-react";
export default async function Page({
  params,
}: {
  params: Promise<{ portfolioId: string; assetId: string }>;
}) {
  const { portfolioId, assetId } = await params;
  const w = await loadWorkspace(portfolioId);
  const p = w.summary.positions.find((p) => p.assetId === assetId);
  if (!p) notFound();
  const user = await requireUser();
  const data = await strategyService(getDb(), user.id).load(
    portfolioId,
    assetId,
  );
  return (
    <>
      <PageHeading
        icon={
          <AssetIcon
            symbol={p.asset.symbol}
            logoUrl={p.asset.logoUrl}
            size={32}
          />
        }
        eyebrow={`${w.portfolio.name} / ${p.asset.symbol}`}
        title={p.asset.name}
        description="პოზიციის შედეგები, გეგმა და საინვესტიციო თეზისი."
        action={
          <div className="flex flex-wrap gap-2">
            <PositionShare position={p} />
            <details className="dropdown dropdown-end">
              <summary className="btn btn-ghost btn-square min-h-11 min-w-11" aria-label="მეტი მოქმედება">
                <MoreHorizontal size={18} />
              </summary>
              <ul className="dropdown-content z-20 mt-1 rounded-box border border-base-300 bg-base-200 p-2 shadow-lg">
                <li>
                  <DeletePosition
                    portfolioId={portfolioId}
                    assetId={assetId}
                    revision={w.portfolio.revision}
                  />
                </li>
              </ul>
            </details>
            <TransactionForm
              triggerLabel="დამატება"
              portfolioId={portfolioId}
              revision={w.portfolio.revision}
              assets={w.assets}
              initialAsset={assetId}
            />
          </div>
        }
      />
      {(!p.quote || p.quote.stale) && (
        <div
          role="status"
          className="alert alert-warning alert-soft mb-3 text-xs"
        >
          {!p.quote ? "ფასი მიუწვდომელია" : "ფასი მოძველებულია"}
        </div>
      )}
      <PositionWorkspace
        position={p}
        portfolioId={portfolioId}
        portfolioValue={w.summary.value}
        revision={w.portfolio.revision}
        assets={w.assets}
        entries={w.entries.filter((e) => e.assetId === assetId)}
        plan={data.plan}
        journal={data.journal}
      />
    </>
  );
}
