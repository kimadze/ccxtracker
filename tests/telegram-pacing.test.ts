import { afterEach, expect, it, vi } from "vitest";
import { createTelegramPacer } from "@/server/telegram/send-pacing";
afterEach(() => vi.useRealTimers());
it("paces a chat to one message per second and the instance to at most twenty per second", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  const pace = createTelegramPacer();
  await pace("one");
  let sameChat = false;
  const pending = pace("one").then(() => {
    sameChat = true;
  });
  await vi.advanceTimersByTimeAsync(999);
  expect(sameChat).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  await pending;
  expect(sameChat).toBe(true);
  let other = false;
  const next = pace("two").then(() => {
    other = true;
  });
  await vi.advanceTimersByTimeAsync(49);
  expect(other).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  await next;
  expect(other).toBe(true);
});
