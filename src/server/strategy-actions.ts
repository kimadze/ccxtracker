"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "./auth";
import { getDb } from "./db";
import { strategyService } from "./services/strategy";
import { userError, type ActionResult } from "./errors";
export async function saveExitPlan(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await strategyService(getDb(), user.id).saveExit(input);
    revalidatePath("/portfolios", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e) };
  }
}
export async function saveJournal(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  try {
    const id = await strategyService(getDb(), user.id).saveJournal(input);
    revalidatePath("/portfolios", "layout");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: userError(e) };
  }
}
