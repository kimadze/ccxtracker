import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { unitPrice, percentage, pnlClass } from "@/lib/formatters";
import { MobilePositionHistory } from "@/components/mobile-position-history";
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
import { saleResults, replayLedger } from "@/domain/ledger";
import { closedPosition } from "@/domain/valuation";
export default async function Page({
  params,
}: {
  params: Promise<{ portfolioId: string; assetId: string }>;
}) {
  const { portfolioId, assetId } = await params;
  const w = await loadWorkspace(portfolioId);
  const p =
    w.summary.positions.find((p) => p.assetId === assetId) ??
    closedPosition(replayLedger(w.entries), w.assets, assetId);
  if (!p) notFound();
  const closed = p.quantity === "0";
  const user = await requireUser();
  const data = await strategyService(getDb(), user.id).load(
    portfolioId,
    assetId,
  );
  return (
    <div className="ccx-mobile-position">
      <div className="ccx-position-intro md:hidden">
        <div className="ccx-position-identity">
          <Link href={"/portfolios/" + portfolioId + "/positions"} aria-label="პოზიციებზე დაბრუნება" className="btn btn-ghost btn-square min-h-11 min-w-11">
            <ArrowLeft size={20} aria-hidden="true" />
          </Link>
          <AssetIcon symbol={p.asset.symbol} logoUrl={p.asset.logoUrl} size={32} />
          <h1 className="min-w-0 truncate text-lg font-semibold">{p.asset.name} <span className="text-xs font-medium text-base-content/65">{p.asset.symbol}</span></h1>
        </div>
        {!closed && (
          <>
            <p className="text-xs text-base-content/65">მიმდინარე ფასი</p>
            <p className="mt-1 break-words text-4xl font-semibold tracking-tight tabular-nums">{unitPrice(p.quote?.price ?? null)}</p>
            {p.quote?.change24h != null && <p className={"mt-1 text-sm " + pnlClass(p.quote.change24h)}>24 სთ · {percentage(p.quote.change24h, true)}</p>}
            <MobilePositionHistory asset={p.asset.providerId} />
          </>
        )}
      </div>
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
        description={
          closed
            ? "დახურული პოზიცია · გაყიდვების შედეგები და ისტორია"
            : "პოზიციის შედეგები, გეგმა და საინვესტიციო თეზისი."
        }
        action={
          <div className="flex flex-wrap gap-2">
            {!closed && <div className="ccx-mobile-share"><PositionShare position={p} /></div>}
            <details className="dropdown dropdown-end">
              <summary
                className="btn btn-ghost btn-square min-h-11 min-w-11"
                aria-label="მეტი მოქმედება"
              >
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
      {!closed && (!p.quote || p.quote.stale) && (
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
        entries={w.entries.filter(
          (e) => e.assetId === assetId || e.settlementAssetId === assetId,
        )}
        sales={saleResults(w.entries)}
        plan={data.plan}
        journal={data.journal}
      />
    </div>
  );
}
