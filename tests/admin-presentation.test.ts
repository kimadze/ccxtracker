import { expect, it } from "vitest";
import { deliveryStatus, adminErrorMessage } from "@/lib/admin-presentation";
const now = new Date("2026-10-13T12:00:00Z");
const row = {
  sentAt: null,
  createdAt: now,
  nextAttemptAt: now,
  attempts: 1,
  lastError: null,
};
it("distinguishes delivered, pending, blocked, cancelled, expired and failed deliveries", () => {
  expect(
    deliveryStatus({ ...row, sentAt: now, lastError: "DELIVERY_FAILED" }, now)
      .tone,
  ).toBe("success");
  expect(deliveryStatus(row, now)).toMatchObject({
    tone: "warning",
    pending: true,
  });
  for (const code of ["BOT_BLOCKED", "TELEGRAM_403"])
    expect(deliveryStatus({ ...row, lastError: code }, now).label).toBe(
      "ბოტი დაბლოკილია",
    );
  for (const code of ["CANCELLED", "PREFERENCES_CHANGED"])
    expect(deliveryStatus({ ...row, lastError: code }, now).tone).toBe(
      "neutral",
    );
  expect(deliveryStatus({ ...row, lastError: "EXPIRED" }, now).label).toBe(
    "ვადა გასულია",
  );
  expect(
    deliveryStatus(
      { ...row, createdAt: new Date(now.getTime() - 7 * 3600000) },
      now,
    ).tone,
  ).toBe("neutral");
  expect(
    deliveryStatus({ ...row, lastError: "TELEGRAM_429" }, now).detail,
  ).toContain("ლიმიტი");
  expect(
    deliveryStatus({ ...row, lastError: "private server response" }, now)
      .detail,
  ).not.toContain("private");
});
it("uses safe actionable errors without leaking provider or database messages", () => {
  expect(adminErrorMessage(new Error("ADMIN_PROTECTED"))).toContain("საკუთარი");
  expect(adminErrorMessage(new Error("RETRY_UNAVAILABLE"))).toContain(
    "განაახლე სია",
  );
  expect(adminErrorMessage(new Error("secret postgres detail"))).not.toContain(
    "secret",
  );
});
