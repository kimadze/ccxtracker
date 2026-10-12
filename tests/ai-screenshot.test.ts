import { afterEach, beforeEach, expect, it, vi } from "vitest";
import sharp from "sharp";
import {
  normalizeScreenshot,
  parseScreenshot,
  screenshotAllowed,
} from "@/server/ai/screenshot";
const mocks = vi.hoisted(() => ({
  owned: vi.fn(),
  provider: vi.fn(),
  limit: vi.fn(),
  select: vi.fn(),
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
const owner = { id: "owner", emailVerified: true };
it("looks up the base asset rather than the trading pair", async () => {
  mocks.provider.mockResolvedValue({
    ...trade,
    symbol: "XLM/USDT",
    currency: null,
  });
  expect(await parseScreenshot(owner, await form())).toMatchObject({
    ok: true,
    extraction: { symbol: "XLM", currency: "USDT" },
  });
});
const trade = {
  kind: "sell",
  symbol: "XLM",
  quantity: "500",
  price: "0.12",
  fee: null,
  day: null,
  issues: [],
  status: "filled",
  currency: "USD",
  feeCurrency: null,
  executedQuantity: "500",
  executedPrice: "0.12",
  dateText: null,
  multiple: false,
};
async function image(type = "png") {
  const bytes = await sharp({
    create: { width: 40, height: 40, channels: 3, background: "white" },
  })
    .toFormat(type as "png" | "jpeg" | "webp")
    .toBuffer();
  return new File([new Uint8Array(bytes)], "trade", { type: `image/${type}` });
}
async function form() {
  const data = new FormData();
  data.set("portfolioId", "59e076bd-d708-445b-ab2b-a79a7a6c2bca");
  data.set("timezone", "Asia/Tbilisi");
  data.set("image", await image());
  return data;
}
beforeEach(() => {
  vi.stubEnv("AI_SCREENSHOT_USER_ID", "owner");
  vi.clearAllMocks();
  mocks.owned.mockResolvedValue({});
  mocks.limit.mockResolvedValue(true);
  mocks.provider.mockResolvedValue(trade);
  mocks.select.mockReturnValue({
    from: () => ({
      where: () => ({
        limit: async () => [{ id: "stellar", symbol: "XLM", name: "Stellar" }],
      }),
    }),
  });
});
afterEach(() => vi.unstubAllEnvs());
it("fails closed with absent configuration, unverified, unauthenticated or other accounts", async () => {
  for (const user of [
    null,
    { id: "other", emailVerified: true },
    { id: "owner", emailVerified: false },
  ]) {
    expect(screenshotAllowed(user)).toBe(false);
    expect((await parseScreenshot(user, await form())).ok).toBe(false);
  }
  vi.stubEnv("AI_SCREENSHOT_USER_ID", "");
  expect(screenshotAllowed(owner)).toBe(false);
  expect(mocks.provider).not.toHaveBeenCalled();
  expect(mocks.owned).not.toHaveBeenCalled();
});
it("checks ownership and limits before the paid provider", async () => {
  mocks.owned.mockRejectedValueOnce(new Error("NOT_FOUND"));
  expect((await parseScreenshot(owner, await form())).ok).toBe(false);
  mocks.limit.mockResolvedValue(false);
  expect((await parseScreenshot(owner, await form())).ok).toBe(false);
  expect(mocks.provider).not.toHaveBeenCalled();
});
it.each(["png", "jpeg", "webp"])(
  "fully decodes %s and re-encodes without metadata",
  async (type) => {
    const result = await normalizeScreenshot(await image(type));
    expect(result.startsWith("data:image/jpeg;base64,")).toBe(true);
    const meta = await sharp(
      Buffer.from(result.split(",")[1], "base64"),
    ).metadata();
    expect(meta.exif).toBeUndefined();
  },
);
it("rejects oversized, corrupt, mislabeled, unsupported and multiple files", async () => {
  for (const file of [
    new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big", {
      type: "image/png",
    }),
    new File(["broken"], "bad", { type: "image/png" }),
    new File(["<svg/>"], "svg", { type: "image/svg+xml" }),
    new File([await (await image()).arrayBuffer()], "wrong", {
      type: "image/jpeg",
    }),
  ])
    await expect(normalizeScreenshot(file)).rejects.toThrow();
  const data = await form();
  data.append("image", await image());
  expect((await parseScreenshot(owner, data)).ok).toBe(false);
  expect(mocks.provider).not.toHaveBeenCalled();
});
it.each(["buy", "sell"])(
  "returns a %s draft without writing or sending history",
  async (kind) => {
    mocks.provider.mockResolvedValue({
      ...trade,
      kind,
      executedPrice: "0.000000012",
    });
    expect(await parseScreenshot(owner, await form())).toMatchObject({
      ok: true,
      extraction: { kind, price: "0.000000012" },
    });
    expect(mocks.provider.mock.calls[0][1]).toEqual({
      localToday: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    expect(mocks.provider.mock.calls[0][3]).toMatch(
      /^data:image\/jpeg;base64,/,
    );
  },
);
it.each(["non-USD", "ambiguous numbers"])(
  "returns uncertain extraction for explicit review: %s",
  async (issue) => {
    mocks.provider.mockResolvedValue({ ...trade, issues: [issue] });
    expect(await parseScreenshot(owner, await form())).toMatchObject({
      ok: true,
      extraction: { issues: [issue] },
    });
  },
);
it("blocks multiple records and unexecuted cancellations with specific reasons", async () => {
  mocks.provider.mockResolvedValue({ ...trade, multiple: true });
  expect(await parseScreenshot(owner, await form())).toMatchObject({
    ok: false,
    error: "ამოჭერი მხოლოდ ერთი ტრანზაქცია.",
  });
  mocks.provider.mockResolvedValue({
    ...trade,
    status: "canceled",
    executedQuantity: null,
    executedPrice: null,
  });
  expect(await parseScreenshot(owner, await form())).toMatchObject({
    ok: false,
    error: "ორდერი არ შესრულებულა.",
  });
  expect(mocks.select).not.toHaveBeenCalled();
});
it("does not retry provider failures or leak provider errors", async () => {
  mocks.provider.mockRejectedValue(new Error("private provider response"));
  const result = await parseScreenshot(owner, await form());
  expect(result.ok).toBe(false);
  expect(JSON.stringify(result)).not.toContain("private");
  expect(mocks.provider).toHaveBeenCalledTimes(1);
});
