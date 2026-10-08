import { describe, expect, it } from "vitest";
import { targetTransition } from "@/domain/watchlist-target";
import type { Quote } from "@/domain/types";
describe("fresh target transitions", () => {
  const now = Date.now(),
    quote: Quote = {
      assetId: "btc",
      price: "0.000000000000000001",
      change24h: null,
      updatedAt: new Date(now).toISOString(),
      stale: false,
    };
  it("uses exact decimal comparison for tiny values", () => {
    expect(
      targetTransition(
        "0.000000000000000001",
        false,
        new Date(now - 1),
        quote,
        now,
      )?.notify,
    ).toBe(true);
    expect(
      targetTransition(
        "0.0000000000000000009",
        false,
        new Date(now - 1),
        quote,
        now,
      )?.notify,
    ).toBe(false);
  });
  it("baselines already reached targets without sending an immediate notification", () => {
    expect(
      targetTransition("5", false, null, { ...quote, price: "1" }, now)?.notify,
    ).toBe(false);
    expect(
      targetTransition("5", false, null, { ...quote, price: "10" }, now, "sell")
        ?.notify,
    ).toBe(false);
  });
  it("buys on downward crossings and sells on upward crossings, including the boundary", () => {
    const previous = new Date(now - 1);
    expect(
      targetTransition(
        "5",
        false,
        previous,
        { ...quote, price: "1" },
        now,
        "sell",
      )?.notify,
    ).toBe(false);
    expect(
      targetTransition(
        "5",
        false,
        previous,
        { ...quote, price: "5" },
        now,
        "sell",
      )?.notify,
    ).toBe(true);
    expect(
      targetTransition(
        "5",
        true,
        previous,
        { ...quote, price: "6" },
        now,
        "sell",
      )?.notify,
    ).toBe(false);
    expect(
      targetTransition(
        "5",
        false,
        previous,
        { ...quote, price: "5" },
        now,
        "buy",
      )?.notify,
    ).toBe(true);
  });
  it("ignores missing, stale, old, future, duplicate and out-of-order quotes", () => {
    expect(targetTransition("1", false, null, undefined, now)).toBeNull();
    expect(targetTransition(null, false, null, quote, now)).toBeNull();
    for (const q of [
      { ...quote, stale: true },
      { ...quote, price: "0" },
      { ...quote, updatedAt: new Date(now - 900001).toISOString() },
      { ...quote, updatedAt: new Date(now + 60001).toISOString() },
    ])
      expect(targetTransition("1", false, null, q, now)).toBeNull();
    expect(targetTransition("1", false, new Date(now), quote, now)).toBeNull();
    expect(
      targetTransition("1", false, new Date(now + 1000), quote, now),
    ).toBeNull();
  });
});
