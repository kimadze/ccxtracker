import Link from "next/link";
import { ArrowUpRight, Wallet } from "lucide-react";
import type { WalletSnapshot, WalletNetwork } from "@/domain/wallet";
import { walletSnapshotStale } from "@/domain/wallet";
import { money } from "@/lib/formatters";
import { BalanceValue } from "./ui";

export function WalletPortfolioCard({
  id,
  name,
  network,
  snapshot,
  lastError,
}: {
  id: string;
  name: string;
  network: WalletNetwork;
  snapshot: WalletSnapshot | null;
  lastError: string | null;
}) {
  const stale = snapshot && walletSnapshotStale(snapshot.fetchedAt);
  return (
    <Link
      href={`/wallet-portfolios/${id}`}
      className="card card-border group min-w-0 bg-base-200 transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      aria-label={`${name} — გახსნა`}
    >
      <div className="card-body gap-4 p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-base-300 bg-base-100 text-base-content/70">
            <Wallet size={20} />
          </span>
          <h2
            className="min-w-0 flex-1 truncate text-base font-semibold"
            title={name}
          >
            {name}
          </h2>
          <ArrowUpRight size={18} aria-hidden="true" />
        </div>
        <div>
          <p className="mb-1 text-xs text-base-content/60">
            {snapshot?.complete ? "საფულის ღირებულება" : "ცნობილი ღირებულება"}
          </p>
          <p className="overflow-x-auto whitespace-nowrap text-[28px] font-semibold tabular-nums">
            <BalanceValue>{money(snapshot?.knownValue)}</BalanceValue>
          </p>
          <p className="mt-2 text-xs text-base-content/60">
            {network === "stellar" ? "Stellar" : "Bitcoin"} · Read-only
          </p>
        </div>
        <div className="border-t border-base-300 pt-3 text-xs text-base-content/60">
          {!snapshot
            ? "ბალანსი ჯერ არ შემოწმებულა"
            : lastError || stale
              ? "მონაცემები განახლებას საჭიროებს"
              : !snapshot.complete
                ? "ზოგი აქტივის ფასი უცნობია"
                : `${snapshot.accounts.length} მისამართი`}
        </div>
      </div>
    </Link>
  );
}
