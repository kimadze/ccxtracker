import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "@/server/db";
import {
  scenarios,
  scenarioPrices,
  portfolioTargets,
  assets,
} from "@/server/db/schema";
import { portfolioService, AccessError } from "./portfolio";
import { scenarioSchema, goalSchema } from "@/domain/scenario-validation";
import { idSchema } from "@/domain/validation";
import { decimal } from "@/domain/decimal";
export function scenarioService(db: Database, userId: string) {
  const portfolio = portfolioService(db, userId);
  return {
    async list(portfolioId: string) {
      await portfolio.owned(portfolioId);
      const rows = await db
        .select()
        .from(scenarios)
        .where(eq(scenarios.portfolioId, portfolioId));
      const prices = rows.length
        ? await db
            .select()
            .from(scenarioPrices)
            .where(
              inArray(
                scenarioPrices.scenarioId,
                rows.map((s) => s.id),
              ),
            )
        : [];
      const [goal] = await db
        .select()
        .from(portfolioTargets)
        .where(eq(portfolioTargets.portfolioId, portfolioId));
      return {
        scenarios: rows.map((s) => ({
          id: s.id,
          name: s.name,
          prices: Object.fromEntries(
            prices
              .filter((p) => p.scenarioId === s.id)
              .map((p) => [p.assetId, p.price]),
          ),
        })),
        goal: goal
          ? { target: goal.target, milestones: goal.milestones }
          : null,
      };
    },
    async save(input: unknown, operation: "create" | "update") {
      const data = scenarioSchema.parse(input);
      await portfolio.owned(data.portfolioId);
      if (operation !== "create" && operation !== "update")
        throw new AccessError();
      const known = data.prices.length
        ? await db
            .select({ id: assets.id })
            .from(assets)
            .where(
              inArray(
                assets.id,
                data.prices.map((p) => p.assetId),
              ),
            )
        : [];
      if (known.length !== data.prices.length) throw new Error("UNKNOWN_ASSET");
      await db.transaction(async (tx) => {
        if (operation === "create")
          await tx.insert(scenarios).values({
            id: data.id,
            portfolioId: data.portfolioId,
            name: data.name,
          });
        else {
          const changed = await tx
            .update(scenarios)
            .set({ name: data.name, updatedAt: new Date() })
            .where(
              and(
                eq(scenarios.id, data.id),
                eq(scenarios.portfolioId, data.portfolioId),
              ),
            )
            .returning();
          if (!changed.length) throw new AccessError();
        }
        await tx
          .delete(scenarioPrices)
          .where(eq(scenarioPrices.scenarioId, data.id));
        if (data.prices.length)
          await tx
            .insert(scenarioPrices)
            .values(data.prices.map((p) => ({ ...p, scenarioId: data.id })));
      });
    },
    async remove(portfolioId: string, id: string) {
      idSchema.parse(id);
      await portfolio.owned(portfolioId);
      const rows = await db
        .delete(scenarios)
        .where(
          and(eq(scenarios.id, id), eq(scenarios.portfolioId, portfolioId)),
        )
        .returning();
      if (!rows.length) throw new AccessError();
    },
    async goal(input: unknown) {
      const data = goalSchema.parse(input);
      await portfolio.owned(data.portfolioId);
      if (data.milestones.some((m) => decimal(m).gt(data.target)))
        throw new Error("INVALID_PLAN");
      const milestones = [...new Set(data.milestones)].sort((a, b) =>
        decimal(a).cmp(b),
      );
      await db
        .insert(portfolioTargets)
        .values({ ...data, milestones })
        .onConflictDoUpdate({
          target: portfolioTargets.portfolioId,
          set: { target: data.target, milestones, updatedAt: new Date() },
        });
    },
  };
}
