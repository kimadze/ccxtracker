import Link from "next/link";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { portfolioService } from "@/server/services/portfolio";
import { loadWorkspace } from "@/server/workspace";
import { PortfolioCreate } from "@/components/portfolio-create";
import { BalancePrivacyToggle } from "@/components/shell";
import { Brand } from "@/components/brand";
import { BalanceValue } from "@/components/ui";
import { money, pnlClass } from "@/lib/formatters";
export default async function Portfolios() {
  const user = await requireUser();
  const portfolios = await portfolioService(getDb(), user.id).list();
  const workspaces = await Promise.all(
    portfolios.map((p) => loadWorkspace(p.id)),
  );
  return (
    <main
      id="main"
      className="mx-auto min-h-dvh max-w-[1600px] space-y-4 bg-base-100 p-4 lg:p-5"
    >
      <Brand />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">პორტფელები</h1>
        <div className="flex items-center gap-2">
          <BalancePrivacyToggle />
          <PortfolioCreate />
        </div>
      </header>
      {workspaces.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {workspaces.map((w) => (
            <Link
              key={w.portfolio.id}
              href={`/portfolios/${w.portfolio.id}`}
              className="card min-w-0 border border-base-300 bg-base-200 transition-colors hover:border-primary"
            >
              <div className="card-body gap-2 p-4">
                <h2 className="truncate text-base font-semibold">
                  {w.portfolio.name}
                </h2>
                <p className="overflow-x-auto whitespace-nowrap text-2xl font-semibold tabular-nums">
                  <BalanceValue>{money(w.summary.value)}</BalanceValue>
                </p>
                <p className={`tabular-nums ${pnlClass(w.summary.totalPnl)}`}>
                  <BalanceValue>{money(w.summary.totalPnl)}</BalanceValue>
                  <span className="ml-2 text-xs text-base-content/60">
                    მთლიანი P/L
                  </span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card border border-dashed border-base-300 bg-base-200 p-5 text-sm text-base-content/60">
          შექმენით პირველი პორტფელი.
        </div>
      )}
    </main>
  );
}
