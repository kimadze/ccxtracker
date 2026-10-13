import { expect, it } from "vitest";
import { dailyChange } from "@/domain/daily-change";
import { replayLedger } from "@/domain/ledger";
import { valuePortfolio } from "@/domain/valuation";
import type { LedgerEntry } from "@/domain/types";
const start = new Date("2026-10-11T20:00:00Z"),
  now = new Date("2026-10-12T17:00:00Z");
const baseline = { capturedAt: start, value: "1000" };
const empty = valuePortfolio(replayLedger([]), [], []);
const summary = { ...empty, value: "1125", knownValue: "1125" };
const flow = (
  kind: "deposit" | "withdrawal",
  quantity: string,
  assetId = "USD",
  at = "2026-10-12T06:00:00Z",
): LedgerEntry => ({
  id: kind,
  kind,
  quantity,
  assetId,
  price: null,
  fee: "0",
  sequence: 1,
  occurredAt: at,
});
it("calculates gain, loss and zero using decimal values", () => {
  expect(dailyChange(summary, baseline, [], start, now)).toMatchObject({
    amount: "125",
    percent: "12.5",
  });
  expect(
    dailyChange({ ...summary, value: "875" }, baseline, [], start, now),
  ).toMatchObject({ amount: "-125", percent: "-12.5" });
  expect(
    dailyChange({ ...summary, value: "1000" }, baseline, [], start, now).amount,
  ).toBe("0");
});
it("does not treat cash deposits/withdrawals as gains/losses and uses weighted returns", () => {
  expect(
    dailyChange(
      { ...summary, value: "1625" },
      baseline,
      [flow("deposit", "500")],
      start,
      now,
    ).amount,
  ).toBe("125");
  expect(
    dailyChange(
      { ...summary, value: "625" },
      baseline,
      [flow("withdrawal", "500")],
      start,
      now,
    ).amount,
  ).toBe("125");
  expect(
    dailyChange(
      { ...summary, value: "1500" },
      baseline,
      [flow("deposit", "500")],
      start,
      now,
    ),
  ).toMatchObject({ amount: "0", percent: "0" });
});
it("never substitutes acquisition basis for transferred asset market value", () => {
  expect(
    dailyChange(
      summary,
      baseline,
      [{ ...flow("deposit", "10", "xlm"), price: "0.01" }],
      start,
      now,
    ),
  ).toMatchObject({
    amount: null,
    reason: "აქტივის გადმოტანის ღირებულება უცნობია",
  });
  expect(
    dailyChange(
      summary,
      baseline,
      [flow("withdrawal", "10", "xlm")],
      start,
      now,
    ).amount,
  ).toBeNull();
});
it("does not use old/future baselines or unavailable quotes", () => {
  for (const base of [
    undefined,
    { ...baseline, capturedAt: new Date(start.getTime() - 3600001) },
    { ...baseline, capturedAt: now },
  ])
    expect(dailyChange(summary, base, [], start, now).amount).toBeNull();
  expect(
    dailyChange({ ...summary, stale: true }, baseline, [], start, now).amount,
  ).toBeNull();
  expect(
    dailyChange({ ...summary, complete: false }, baseline, [], start, now)
      .amount,
  ).toBeNull();
});
it("excludes out-of-period flows, permits unknown cost basis and does not divide by zero", () => {
  expect(
    dailyChange(
      { ...summary, costBasis: null },
      baseline,
      [
        flow("deposit", "500", "USD", start.toISOString()),
        flow("deposit", "500", "USD", "2026-10-13T00:00:00Z"),
      ],
      start,
      now,
    ).amount,
  ).toBe("125");
  expect(
    dailyChange(
      { ...summary, value: "0" },
      { ...baseline, value: "0" },
      [],
      start,
      now,
    ),
  ).toMatchObject({ amount: "0", percent: null });
});
