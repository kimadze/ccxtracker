import { afterEach, describe, expect, it, vi } from "vitest";
import { validateAiTransaction } from "@/domain/ai-transaction";
import { lunaJson } from "@/server/ai/client";
const trade = {
  kind: "sell",
  symbol: "xlm",
  quantity: "500",
  price: "0.12",
  fee: null,
  day: null,
  issues: [],
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("AI draft boundary", () => {
  it("retains precise strings and distinguishes unknown from explicit zero cost", () => {
    expect(validateAiTransaction(trade)).toMatchObject({
      symbol: "XLM",
      quantity: "500",
      price: "0.12",
    });
    expect(
      validateAiTransaction({ ...trade, kind: "deposit", price: null }).price,
    ).toBeNull();
    expect(
      validateAiTransaction({ ...trade, kind: "deposit", price: "0" }).price,
    ).toBe("0");
    expect(
      validateAiTransaction({ ...trade, quantity: "0.000000000000000001" })
        .quantity,
    ).toBe("0.000000000000000001");
  });
  it.each([
    { quantity: "0" },
    { quantity: "-1" },
    { price: null },
    { price: "0" },
    { fee: "-1" },
    { day: "2026-02-30" },
    { issues: ["two trades"] },
    { symbol: "USD" },
  ])("rejects unsafe or incomplete drafts %j", (patch) =>
    expect(() => validateAiTransaction({ ...trade, ...patch })).toThrow(),
  );
  it("does not retain OpenAI responses and only uses the fixed model/endpoint", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-only");
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            status: "completed",
            output: [
              {
                content: [{ type: "output_text", text: JSON.stringify(trade) }],
              },
            ],
          }),
        ),
    );
    vi.stubGlobal("fetch", fetcher);
    expect(await lunaJson("extract", { text: "sold" }, {})).toEqual(trade);
    expect((fetcher.mock.calls[0] as unknown as [string, RequestInit])[0]).toBe(
      "https://api.openai.com/v1/responses",
    );
    const request = JSON.parse(
      (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1]
        .body as string,
    );
    expect(request).toMatchObject({
      model: "gpt-6-luna",
      store: false,
      max_output_tokens: 600,
    });
  });
  it("sanitizes provider failures and refuses incomplete responses", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-only");
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            status: "incomplete",
            error: "private provider data",
          }),
        ),
    );
    await expect(lunaJson("", {}, {})).rejects.toThrow("AI_UNAVAILABLE");
  });
  it("does not call a provider without configuration", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(lunaJson("", {}, {})).rejects.toThrow("AI_NOT_CONFIGURED");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
