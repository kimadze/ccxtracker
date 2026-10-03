"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "./auth";
import { getDb } from "./db";
import { walletService } from "./services/wallet";
import { consumeRateLimit } from "./rate-limit";
import { userError, type ActionResult } from "./errors";

function walletError(e: unknown) {
  if (e instanceof Error) {
    if (e.message === "WALLET_REFRESH_LIMIT")
      return "განახლება შესაძლებელია წუთში ერთხელ.";
    if (e.message === "WALLET_RATE_LIMIT")
      return "მონაცემების წყაროს ლიმიტი ამოიწურა. სცადეთ მოგვიანებით.";
    if (
      e.message === "WALLET_PROVIDER_FAILED" ||
      e.message === "WALLET_NOT_FOUND"
    )
      return "ბალანსის მიღება ვერ მოხერხდა. სცადეთ ხელახლა.";
  }
  return userError(e);
}
export async function createWalletPortfolio(
  input: unknown,
): Promise<ActionResult> {
  const u = await requireUser();
  try {
    if (!(await consumeRateLimit(`wallet-create:${u.id}`, 10, 600000)))
      return { ok: false, error: "სცადეთ მოგვიანებით." };
    const p = await walletService(getDb(), u.id).create(input);
    revalidatePath("/portfolios");
    return { ok: true, id: p.id };
  } catch (e) {
    return { ok: false, error: walletError(e) };
  }
}
export async function updateWalletPortfolio(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  const u = await requireUser();
  try {
    await walletService(getDb(), u.id).update(id, input);
    revalidatePath("/portfolios");
    revalidatePath(`/wallet-portfolios/${id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: walletError(e) };
  }
}
export async function refreshWalletPortfolio(
  id: string,
): Promise<ActionResult> {
  const u = await requireUser();
  try {
    if (!(await consumeRateLimit(`wallet-refresh:${u.id}`, 20, 600000)))
      return {
        ok: false,
        error: "განახლების ლიმიტი ამოიწურა. სცადეთ მოგვიანებით.",
      };
    await walletService(getDb(), u.id).refresh(id);
    revalidatePath("/portfolios");
    revalidatePath(`/wallet-portfolios/${id}`);
    return { ok: true };
  } catch (e) {
    revalidatePath(`/wallet-portfolios/${id}`);
    return { ok: false, error: walletError(e) };
  }
}
export async function removeWalletPortfolio(id: string): Promise<ActionResult> {
  const u = await requireUser();
  try {
    await walletService(getDb(), u.id).remove(id);
    revalidatePath("/portfolios");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: walletError(e) };
  }
}
