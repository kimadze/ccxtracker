import { beforeEach, afterAll, expect, it, vi } from "vitest";
import { parseTransactionText } from "@/server/ai/actions";
const mocks = vi.hoisted(() => ({
  owned: vi.fn(),
  provider: vi.fn(),
  limit: vi.fn(),
  select: vi.fn(),
}));
vi.mock("@/server/auth", () => ({
  requireUser: async () => ({ id: "owner" }),
}));
vi.mock("@/server/db", () => ({ getDb: () => ({ select: mocks.select }) }));
vi.mock("@/server/services/portfolio", () => ({
  portfolioService: () => ({ owned: mocks.owned }),
}));
vi.mock("@/server/rate-limit", () => ({ consumeRateLimit: mocks.limit }));
vi.mock("@/server/ai/client", () => ({
  aiConfigured: () => true,
  lunaJson: mocks.provider,
}));
const input = {
  portfolioId: "59e076bd-d708-445b-ab2b-a79a7a6c2bca",
  text: "გავყიდე 500 XLM თითო $0.12-ად",
  timezone: "Asia/Tbilisi",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.owned.mockResolvedValue({});
  mocks.limit.mockResolvedValue(true);
  mocks.provider.mockResolvedValue({
    kind: "sell",
    symbol: "XLM",
    quantity: "500",
    price: "0.12",
    fee: null,
    day: null,
    issues: [],
  });
  mocks.select.mockReturnValue({
    from: () => ({
      where: () => ({
        limit: async () => [{ id: "stellar", symbol: "XLM", name: "Stellar" }],
      }),
    }),
  });
});
afterAll(() => vi.restoreAllMocks());
it("checks ownership before calling the paid provider", async () => {
  mocks.owned.mockRejectedValue(new Error("RESOURCE_NOT_FOUND"));
  expect((await parseTransactionText(input)).ok).toBe(false);
  expect(mocks.provider).not.toHaveBeenCalled();
});
it("rejects oversized text without calling the provider", async () => {
  expect(
    (await parseTransactionText({ ...input, text: "x".repeat(601) })).ok,
  ).toBe(false);
  expect(mocks.provider).not.toHaveBeenCalled();
});
it("enforces request caps before calling the provider", async () => {
  mocks.limit.mockResolvedValue(false);
  expect((await parseTransactionText(input)).ok).toBe(false);
  expect(mocks.provider).not.toHaveBeenCalled();
});
it("returns choices and a draft without exposing portfolio history", async () => {
  const result = await parseTransactionText(input);
  expect(result).toMatchObject({
    ok: true,
    draft: { quantity: "500", price: "0.12" },
    matches: [{ id: "stellar" }],
  });
  expect(mocks.provider.mock.calls[0][1]).toEqual({
    text: input.text,
    localToday: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
  });
});
it("cannot apply incomplete or fabricated response structure", async () => {
  mocks.provider.mockResolvedValue({
    kind: "sell",
    quantity: "500",
    price: "0.12",
    admin: true,
  });
  expect((await parseTransactionText(input)).ok).toBe(false);
  expect(mocks.select).not.toHaveBeenCalled();
});
