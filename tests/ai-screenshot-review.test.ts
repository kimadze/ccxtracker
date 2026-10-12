import { expect, it } from "vitest";
import { reviewScreenshot, confirmScreenshot } from "@/domain/ai-screenshot";
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
it("requires currency and review confirmation, complete day and explicit fee", () => {
  const extraction = reviewScreenshot(base);
  expect(() => confirmScreenshot(extraction, fields, true, false)).toThrow(
    "1:1",
  );
  expect(() => confirmScreenshot(extraction, fields, false, true)).toThrow();
  expect(() =>
    confirmScreenshot(extraction, { ...fields, fee: "" }, true, true),
  ).toThrow();
  expect(() =>
    confirmScreenshot(extraction, { ...fields, day: "" }, true, true),
  ).toThrow();
  expect(confirmScreenshot(extraction, fields, true, true)).toMatchObject({
    fee: "0",
    day: "2026-10-12",
    quantity: "526.05",
  });
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
