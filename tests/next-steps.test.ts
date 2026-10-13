import { expect, it } from "vitest";
import { rankNextSteps, type NextStep } from "@/domain/next-steps";
import type { Quote } from "@/domain/types";
const now = Date.parse("2026-10-13T10:00:00Z");
const row: NextStep = {
  id: "a",
  asset: {
    id: "xlm",
    symbol: "XLM",
    name: "Stellar",
    providerId: "stellar",
    isStablecoin: false,
  },
  kind: "tp",
  target: "0.117",
  current: null,
  distance: null,
  share: "20",
  reached: false,
};
const quote: Quote = {
  assetId: "xlm",
  price: "0.1",
  change24h: null,
  updatedAt: new Date(now).toISOString(),
  stale: false,
};
it("calculates signed distance using decimals without treating a price observation as reached or sold", () => {
  const [result] = rankNextSteps([row], [quote], now);
  expect(result.distance).toBe("17");
  expect(result.reached).toBe(false);
  expect(result.share).toBe("20");
  expect(
    rankNextSteps([{ ...row, target: "0.08", kind: "fall" }], [quote], now)[0]
      .distance,
  ).toBe("-20");
});
it("does not calculate distance from missing, stale, zero or future prices", () => {
  for (const q of [
    undefined,
    { ...quote, stale: true },
    { ...quote, price: "0" },
    { ...quote, updatedAt: new Date(now - 900001).toISOString() },
    { ...quote, updatedAt: new Date(now + 60001).toISOString() },
  ]) {
    expect(rankNextSteps([row], q ? [q] : [], now)[0].distance).toBeNull();
  }
});
it("ranks fresh nearest targets ahead of unknown prices and recorded reached targets", () => {
  const rows = [
    { ...row, id: "unknown", asset: { ...row.asset, id: "missing" } },
    { ...row, id: "far", target: "0.2" },
    { ...row, id: "near", target: "0.11" },
    { ...row, id: "reached", target: "0.1", reached: true },
  ];
  expect(rankNextSteps(rows, [quote], now).map((r) => r.id)).toEqual([
    "near",
    "far",
    "unknown",
    "reached",
  ]);
});
