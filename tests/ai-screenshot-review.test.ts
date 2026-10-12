import { expect, it } from "vitest";
import { reviewScreenshot, confirmScreenshot } from "@/domain/ai-screenshot";
it("separates explicit market pair from its quote currency", () => {
  expect(
    reviewScreenshot({ ...base, symbol: " strk/usdt ", currency: null }),
  ).toMatchObject({ symbol: "STRK", currency: "USDT" });
  expect(
    reviewScreenshot({ ...base, symbol: "STRK/USDT", currency: "EUR" }),
  ).toMatchObject({ symbol: "STRK", currency: null });
});
const base = {
  kind: "sell",
  symbol: "STRK",
  quantity: "1000",
  price: "1",
  fee: null,
  day: null,
  issues: [],
  status: "filled",
  currency: "USDT",
  feeCurrency: null,
  executedQuantity: "526.05",
  executedPrice: "0.11565",
  dateText: "10-12 00:55:47",
  multiple: false,
};
const fields = {
  kind: "sell",
  quantity: "526.05",
  price: "0.11565",
  fee: "0",
  day: "2026-10-12",
};
it.each(["filled", "completed"])("uses actual execution for %s", (status) => {
  expect(reviewScreenshot({ ...base, status })).toMatchObject({
    quantity: "526.05",
    price: "0.11565",
    currency: "USDT",
    day: null,
    partial: false,
  });
});
it.each(["canceled", "cancelled", "rejected", "expired"])(
  "rejects unexecuted %s even with requested amount and price",
  (status) => {
    for (const executedQuantity of [null, "0"])
      expect(() =>
        reviewScreenshot({
          ...base,
          status,
          executedQuantity,
          executedPrice: null,
        }),
      ).toThrow("ორდერი არ შესრულებულა");
  },
);
it.each(["canceled", "partially_filled", "open", "pending", "unknown"])(
  "uses only explicit execution for %s",
  (status) => {
    expect(reviewScreenshot({ ...base, status })).toMatchObject({
      quantity: "526.05",
      price: "0.11565",
      partial: true,
    });
    expect(() =>
      reviewScreenshot({ ...base, status, executedPrice: null }),
    ).toThrow();
  },
);
it("requires a positive settlement rate, review confirmation and complete day", () => {
  const extraction = reviewScreenshot(base);
  expect(() => confirmScreenshot(extraction, fields, true, "")).toThrow();
  expect(() => confirmScreenshot(extraction, fields, false, "1")).toThrow();
  expect(() =>
    confirmScreenshot(extraction, { ...fields, day: "" }, true, "1"),
  ).toThrow();
  expect(confirmScreenshot(extraction, fields, true, "1")).toMatchObject({
    fee: "0",
    day: "2026-10-12",
    quantity: "526.05",
  });
});
it.each(["", "   ", "0", "0.25"])("accepts optional fee %j", (fee) => {
  expect(
    confirmScreenshot(reviewScreenshot(base), { ...fields, fee }, true, "1")
      .fee,
  ).toBe(fee.trim() || "0");
});
it.each(["-1", "invalid"])("rejects invalid explicit fee %j", (fee) => {
  expect(() =>
    confirmScreenshot(reviewScreenshot(base), { ...fields, fee }, true, "1"),
  ).toThrow();
});
it("preserves foreign currency, missing prices and issues without inventing facts", () => {
  expect(
    reviewScreenshot({
      ...base,
      currency: "EUR",
      executedPrice: null,
      price: null,
      issues: ["დააზუსტე ფასი"],
    }),
  ).toMatchObject({ currency: "EUR", price: null, issues: ["დააზუსტე ფასი"] });
  expect(() => reviewScreenshot({ ...base, multiple: true })).toThrow(
    "ერთი ტრანზაქცია",
  );
});
