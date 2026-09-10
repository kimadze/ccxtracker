"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "./auth";
import { getDb } from "./db";
import { scenarioService } from "./services/scenarios";
import { userError, type ActionResult } from "./errors";
export async function saveScenario(
  input: unknown,
  operation: "create" | "update",
): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await scenarioService(getDb(), user.id).save(input, operation);
    revalidatePath("/portfolios", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e) };
  }
}
export async function deleteScenario(
  portfolioId: string,
  id: string,
): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await scenarioService(getDb(), user.id).remove(portfolioId, id);
    revalidatePath("/portfolios", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e) };
  }
}
export async function saveGoal(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await scenarioService(getDb(), user.id).goal(input);
    revalidatePath("/portfolios", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e) };
  }
}
