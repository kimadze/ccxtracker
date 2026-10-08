import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { registerTelegramWebhook } from "@/server/telegram/setup";
import { POST } from "@/app/api/telegram/setup/route";
const transport = vi.fn();
beforeEach(() => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-only-token");
  vi.stubEnv("TELEGRAM_BOT_USERNAME", "CCXTRACKER_BOT");
  vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "x".repeat(40));
  vi.stubEnv("BETTER_AUTH_URL", "https://ccxtracker.example.test");
  vi.stubEnv("CRON_SECRET", "y".repeat(40));
  transport.mockReset();
  vi.stubGlobal("fetch", transport);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
function response(result: unknown) {
  return new Response(JSON.stringify({ ok: true, result }));
}
it("rejects unauthenticated operator calls before any Telegram request", async () => {
  expect(
    (
      await POST(
        new Request("https://ccxtracker.example.test/api/telegram/setup", {
          method: "POST",
        }),
      )
    ).status,
  ).toBe(401);
  expect(transport).not.toHaveBeenCalled();
});
it("checks identity, registers the protected webhook and verifies it without messages", async () => {
  const url = "https://ccxtracker.example.test/api/telegram/webhook";
  transport
    .mockResolvedValueOnce(
      response({ is_bot: true, username: "CCXTRACKER_BOT" }),
    )
    .mockResolvedValueOnce(response({ url: "" }))
    .mockResolvedValueOnce(response(true))
    .mockResolvedValueOnce(response({ url }));
  expect(await registerTelegramWebhook()).toEqual({
    username: "CCXTRACKER_BOT",
    registered: true,
  });
  expect(transport.mock.calls.map((c) => c[0].split("/").at(-1))).toEqual([
    "getMe",
    "getWebhookInfo",
    "setWebhook",
    "getWebhookInfo",
  ]);
  const request = JSON.parse(transport.mock.calls[2][1].body);
  expect(request).toMatchObject({
    url,
    secret_token: "x".repeat(40),
    allowed_updates: ["message"],
  });
  expect(request.drop_pending_updates).toBeUndefined();
});
it("refuses the wrong bot token without modifying its webhook", async () => {
  transport.mockResolvedValueOnce(
    response({ is_bot: true, username: "another_bot" }),
  );
  await expect(registerTelegramWebhook()).rejects.toThrow(
    "TELEGRAM_BOT_MISMATCH",
  );
  expect(transport).toHaveBeenCalledTimes(1);
});
it("refuses to replace another application's webhook", async () => {
  transport
    .mockResolvedValueOnce(
      response({ is_bot: true, username: "CCXTRACKER_BOT" }),
    )
    .mockResolvedValueOnce(
      response({ url: "https://other.example.test/webhook" }),
    );
  await expect(registerTelegramWebhook()).rejects.toThrow(
    "TELEGRAM_WEBHOOK_IN_USE",
  );
  expect(transport).toHaveBeenCalledTimes(2);
});
