import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { journals } from "@/server/db/schema";
import { portfolioService } from "@/server/services/portfolio";
import { scenarioService } from "@/server/services/scenarios";
import { allocationService } from "@/server/services/allocation";
import { watchlistService } from "@/server/services/watchlist";
import { strategyService } from "@/server/services/strategy";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ portfolioId: string }> },
) {
  const user = await getCurrentUser();
  if (!user)
    return Response.json(
      { error: "საჭიროა ანგარიშში შესვლა." },
      { status: 401 },
    );
  try {
    const { portfolioId } = await params;
    const db = getDb();
    const service = portfolioService(db, user.id);
    const portfolio = await service.owned(portfolioId);
    const [entries, scenarioData, allocation, watchlist, journal] =
      await Promise.all([
        service.entries(portfolioId),
        scenarioService(db, user.id).list(portfolioId),
        allocationService(db, user.id).list(portfolioId),
        watchlistService(db, user.id).list(portfolioId),
        db.select().from(journals).where(eq(journals.portfolioId, portfolioId)),
      ]);
    const ids = [...new Set(entries.map((e) => e.assetId))];
    const plans = await Promise.all(
      ids.map(async (assetId) => ({
        assetId,
        ...(await strategyService(db, user.id).load(portfolioId, assetId)).plan,
      })),
    );
    return Response.json(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        portfolio: {
          id: portfolio.id,
          name: portfolio.name,
          baseCurrency: portfolio.baseCurrency,
        },
        transactions: entries,
        scenarios: scenarioData.scenarios,
        goal: scenarioData.goal,
        targetAllocation: allocation,
        exitPlans: plans,
        journal,
        watchlist,
      },
      {
        headers: {
          "Content-Disposition": 'attachment; filename="ccx-portfolio.json"',
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch {
    return Response.json(
      { error: "მონაცემების ჩამოტვირთვა ვერ მოხერხდა." },
      { status: 404 },
    );
  }
}
