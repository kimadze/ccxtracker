import { describe, expect, it } from "vitest";
import { positiveAmount, transactionSchema } from "@/domain/validation";
describe("incomplete financial drafts", () => {
  it("returns validation issues instead of throwing for empty or malformed decimals", () => {
    for (const value of ["", " ", "abc", ".", "0.", "1e20", "-1"]) {
      expect(() => positiveAmount.safeParse(value)).not.toThrow();
      expect(positiveAmount.safeParse(value).success).toBe(false);
      expect(() =>
        transactionSchema.safeParse({
          id: crypto.randomUUID(),
          portfolioId: crypto.randomUUID(),
          assetId: "btc",
          kind: "buy",
          quantity: "1",
          price: value,
          fee: "0",
          occurredAt: "2026-01-01T00:00:00Z",
          notes: "",
        }),
      ).not.toThrow();
    }
  });
  it("keeps explicit zero basis valid only for existing holdings", () => {
    const input = {
      id: crypto.randomUUID(),
      portfolioId: crypto.randomUUID(),
      assetId: "btc",
      quantity: "1",
      price: "0",
      fee: "0",
      occurredAt: "2026-01-01T00:00:00Z",
      notes: "",
    };
    expect(
      transactionSchema.safeParse({ ...input, kind: "deposit" }).success,
    ).toBe(true);
    expect(transactionSchema.safeParse({ ...input, kind: "buy" }).success).toBe(
      false,
    );
  });
});
