"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "./auth";
import { getDb } from "./db";
import { allocationService } from "./services/allocation";
import { userError, type ActionResult } from "./errors";
export async function saveAllocation(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await allocationService(getDb(), user.id).save(input);
    revalidatePath("/portfolios", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e) };
  }
}
