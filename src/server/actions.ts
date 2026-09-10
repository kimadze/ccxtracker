"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireUser } from "./auth";
import { getDb } from "./db";
import { assets } from "./db/schema";
import { portfolioService } from "./services/portfolio";
import { seedAssets } from "./market";
import { CoinGeckoProvider } from "./market/provider";
import { userError, type ActionResult } from "./errors";

export async function createPortfolio(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  try { await seedAssets(); const p = await portfolioService(getDb(), user.id).create(input); revalidatePath("/portfolios"); return { ok: true, id: p.id }; }
  catch (e) { return { ok: false, error: userError(e) }; }
}
export async function saveTransaction(input: unknown, operation: "create" | "update", revision: number): Promise<ActionResult> {
  const user = await requireUser();
  try { if (operation !== "create" && operation !== "update") throw new Error("INVALID_TRANSACTION"); await portfolioService(getDb(), user.id).mutateTransaction(input, operation, revision); revalidatePath("/portfolios", "layout"); return { ok: true }; }
  catch (e) { return { ok: false, error: userError(e) }; }
}
export async function deleteTransaction(portfolioId: string, id: string, revision: number): Promise<ActionResult> {
  const user = await requireUser();
  try { await portfolioService(getDb(), user.id).deleteTransaction(portfolioId, id, revision); revalidatePath("/portfolios", "layout"); return { ok: true }; }
  catch (e) { return { ok: false, error: userError(e) }; }
}
export async function renamePortfolio(id: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  try { await portfolioService(getDb(), user.id).rename(id, input); revalidatePath("/portfolios", "layout"); return { ok: true }; }
  catch (e) { return { ok: false, error: userError(e) }; }
}
export async function removePortfolio(id: string): Promise<ActionResult> {
  const user = await requireUser();
  try { await portfolioService(getDb(), user.id).remove(id); revalidatePath("/portfolios", "layout"); return { ok: true }; }
  catch (e) { return { ok: false, error: userError(e) }; }
}
export async function searchAssets(query: string) {
  await requireUser();
  try {
    if (typeof query !== "string" || query.trim().length < 2 || query.length > 60) return { ok: false as const, error: "შეიყვანეთ მინიმუმ 2 სიმბოლო." };
    const matches = await new CoinGeckoProvider().search(query.trim());
    for (const asset of matches) {
      const [existing] = await getDb().select().from(assets).where(eq(assets.id, asset.id));
      if (!existing) await getDb().insert(assets).values(asset).onConflictDoNothing();
    }
    return { ok: true as const, assets: matches };
  } catch (e) { return { ok: false as const, error: userError(e) }; }
}
