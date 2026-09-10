"use server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "./auth";
import { getDb } from "./db";
import { users, sessions, userSettings } from "./db/schema";
import { watchlistService } from "./services/watchlist";
import { userError, type ActionResult } from "./errors";
export async function saveWatchlist(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await watchlistService(getDb(), user.id).save(input);
    revalidatePath("/portfolios", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e) };
  }
}
export async function removeWatchlist(
  portfolioId: string,
  id: string,
): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await watchlistService(getDb(), user.id).remove(portfolioId, id);
    revalidatePath("/portfolios", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e) };
  }
}
export async function updateProfile(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  try {
    const data = z
      .object({
        name: z
          .string()
          .trim()
          .min(1, "სახელი აუცილებელია.")
          .max(80, "სახელი არ უნდა აღემატებოდეს 80 სიმბოლოს."),
      })
      .parse(input);
    await getDb().transaction(async (tx) => {
      await tx
        .update(users)
        .set({ name: data.name, updatedAt: new Date() })
        .where(eq(users.id, user.id));
      await tx
        .insert(userSettings)
        .values({ userId: user.id })
        .onConflictDoNothing();
    });
    revalidatePath("/portfolios", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e) };
  }
}
export async function revokeSessions(): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await getDb().delete(sessions).where(eq(sessions.userId, user.id));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e) };
  }
}
