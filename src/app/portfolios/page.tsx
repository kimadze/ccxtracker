import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { portfolioService } from "@/server/services/portfolio";
import { loadPortfolioCard } from "@/server/workspace";
import { PortfolioCreate } from "@/components/portfolio-create";
import { BalancePrivacyToggle } from "@/components/shell";
import { Brand } from "@/components/brand";
import { PortfolioCard } from "@/components/portfolio-card";
import { walletService } from "@/server/services/wallet";
import { WalletPortfolioCard } from "@/components/wallet-portfolio-card";
import Link from "next/link";
import { isAdmin } from "@/server/admin-access";
export default async function Portfolios() {
  const user = await requireUser();
  const portfolios = await portfolioService(getDb(), user.id).list();
  const wallets = await walletService(getDb(), user.id).list();
  const workspaces = await Promise.all(
    portfolios.map((p) => loadPortfolioCard(p.id)),
  );
  return (
    <main
      id="main"
      className="mx-auto min-h-dvh max-w-[1120px] space-y-5 bg-base-100 p-4 lg:p-5"
    >
      <div className="flex items-center justify-between border-b border-base-300 pb-4">
        <Brand />
        <div className="flex items-center gap-2">
          {isAdmin(user) && (
            <Link href="/admin" className="btn btn-ghost min-h-11">
              ადმინისტრირება
            </Link>
          )}
          <BalancePrivacyToggle />
        </div>
      </div>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">პორტფელები</h1>
          <p className="mt-1 text-xs text-base-content/60">
            {portfolios.length + wallets.length} პორტფელი
          </p>
        </div>
        <PortfolioCreate />
      </header>
      {workspaces.length + wallets.length ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((w) => (
            <PortfolioCard
              key={w.portfolio.id}
              id={w.portfolio.id}
              name={w.portfolio.name}
              summary={w.summary}
            />
          ))}
          {wallets.map((w) => (
            <WalletPortfolioCard
              key={w.id}
              id={w.id}
              name={w.name}
              network={w.network}
              snapshot={w.snapshot}
              lastError={w.lastError}
            />
          ))}
        </div>
      ) : (
        <div className="card card-dash bg-base-200 p-5 text-sm text-base-content/60">
          შექმენით პირველი პორტფელი.
        </div>
      )}
    </main>
  );
}
