"use server";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "./auth";
import { isAdmin } from "./admin-access";
import { getDb } from "./db";
import { adminService } from "./admin";
import { consumeRateLimit } from "./rate-limit";
import { adminErrorMessage } from "@/lib/admin-presentation";

export async function adminAction(
  kind: "controls" | "suspend" | "retry",
  input: unknown,
) {
  const user = await requireUser();
  if (!isAdmin(user)) notFound();
  try {
    if (!(await consumeRateLimit(`admin:${user.id}`, 20, 60000)))
      return {
        ok: false,
        error: "მოქმედებების ლიმიტი ამოიწურა. სცადე ცოტა მოგვიანებით.",
      };
    const service = adminService(getDb(), user);
    if (kind === "controls") await service.controls(input);
    else if (kind === "suspend") await service.suspend(input);
    else if (kind === "retry") await service.retry(input);
    else return { ok: false, error: "მოქმედება მიუწვდომელია." };
    revalidatePath("/admin");
    return { ok: true, error: null };
  } catch (error) {
    return {
      ok: false,
      error: adminErrorMessage(error),
    };
  }
}
