import { describe, expect, it } from "vitest";
import { replayLedger } from "@/domain/ledger";
import { valuePortfolio } from "@/domain/valuation";
import { percent, amount } from "@/domain/decimal";
import type { LedgerEntry } from "@/domain/types";
import { transactionSchema } from "@/domain/validation";

let sequence = 0;
function entry(
  kind: LedgerEntry["kind"],
  assetId: string,
  quantity: string,
  price: string | null = null,
  fee = "0",
): LedgerEntry {
  sequence++;
  return {
    id: `e${sequence}`,
    kind,
    assetId,
    quantity,
    price,
    fee,
    occurredAt: "2026-01-01T12:00:00Z",
    sequence,
  };
}
const fund = () => entry("deposit", "USD", "10000");
describe("canonical ledger", () => {
  it("handles an empty portfolio and zero denominators", () => {
    expect(replayLedger([]).cash).toBe("0");
    expect(percent("1", "0")).toBeNull();
  });
  it("capitalizes buy fees and computes weighted average", () => {
    const r = replayLedger([
      fund(),
      entry("buy", "btc", "2", "100", "2"),
      entry("buy", "btc", "1", "200", "3"),
    ]);
    expect(r.cash).toBe("9595");
    expect(r.holdings[0].costBasis).toBe("405");
    expect(r.holdings[0].averagePrice).toBe("135");
  });
  it("realizes partial sale profit net of fees and preserves remaining basis", () => {
    const r = replayLedger([
      fund(),
      entry("buy", "btc", "2", "100", "2"),
      entry("sell", "btc", "0.5", "150", "1"),
    ]);
    expect(r.realizedPnl).toBe("23.5");
    expect(r.holdings[0].costBasis).toBe("151.5");
    expect(r.holdings[0].averagePrice).toBe("101");
    expect(r.cash).toBe("9872");
  });
  it("supports full sale losses and reopening", () => {
    const r = replayLedger([
      fund(),
      entry("buy", "btc", "1", "100"),
      entry("sell", "btc", "1", "50"),
      entry("buy", "btc", "2", "25"),
    ]);
    expect(r.realizedPnl).toBe("-50");
    expect(r.holdings[0].averagePrice).toBe("25");
  });
  it("rejects overselling and unfunded purchases", () => {
    expect(() => replayLedger([entry("sell", "btc", "1", "100")])).toThrow(
      "INSUFFICIENT_HOLDINGS",
    );
    expect(() => replayLedger([entry("buy", "btc", "1", "100")])).toThrow(
      "INSUFFICIENT_CASH",
    );
  });
  it("rejects invalid backdated balances even when final balances would be valid", () => {
    const buy = entry("buy", "btc", "1", "100");
    const funding = { ...fund(), occurredAt: "2026-01-02T12:00:00Z" };
    expect(() => replayLedger([funding, buy])).toThrow("INSUFFICIENT_CASH");
  });
  it("transfers out basis without recognizing a sale", () => {
    const r = replayLedger([
      entry("deposit", "btc", "2", "100"),
      entry("withdrawal", "btc", "0.5"),
    ]);
    expect(r.holdings[0].costBasis).toBe("150");
    expect(r.realizedPnl).toBe("0");
    expect(r.withdrawals).toBe("50");
  });
  it("keeps unknown cost basis unavailable", () => {
    const r = replayLedger([
      entry("deposit", "btc", "2"),
      entry("sell", "btc", "1", "100"),
    ]);
    expect(r.holdings[0].costBasis).toBeNull();
    expect(r.realizedPnl).toBeNull();
  });
  it("accounts for asset fees and cash fees once", () => {
    const r = replayLedger([
      fund(),
      entry("buy", "btc", "2", "100"),
      entry("fee", "btc", "0.1", null, "2"),
      entry("fee", "USD", "5"),
    ]);
    expect(r.realizedPnl).toBe("-17");
    expect(r.holdings[0].costBasis).toBe("190");
    expect(r.cash).toBe("9793");
  });
  it("does not lose precision at small quantities", () => {
    const r = replayLedger([
      fund(),
      entry("buy", "btc", "0.000000000000000001", "100000"),
    ]);
    expect(r.holdings[0].quantity).toBe("0.000000000000000001");
    expect(r.holdings[0].costBasis).toBe("0.0000000000001");
    expect(amount("0.1")).toBe("0.1");
  });
  it("rejects NaN, infinity, negative quantities and zero trade prices", () => {
    for (const q of ["NaN", "Infinity", "-1", "0"])
      expect(() => replayLedger([entry("deposit", "btc", q, "1")])).toThrow();
    expect(() =>
      replayLedger([fund(), entry("buy", "btc", "1", "0")]),
    ).toThrow();
  });
  it("validates decimal input and future dates", () => {
    const input = {
      ...entry("buy", "btc", "1e5", "100"),
      id: crypto.randomUUID(),
      portfolioId: crypto.randomUUID(),
      notes: "",
    };
    expect(transactionSchema.safeParse(input).success).toBe(false);
    expect(
      transactionSchema.parse({ ...input, quantity: "0,1", price: "1 000,50" })
        .quantity,
    ).toBe("0.1");
    expect(
      transactionSchema.parse({ ...input, quantity: "0,1", price: "1 000,50" })
        .price,
    ).toBe("1000.50");
    expect(
      transactionSchema.safeParse({
        ...input,
        quantity: "1",
        occurredAt: "2099-01-01T00:00:00Z",
      }).success,
    ).toBe(false);
  });
});
describe("valuation", () => {
  const assets = [
    {
      id: "btc",
      providerId: "bitcoin",
      symbol: "BTC",
      name: "Bitcoin",
      isStablecoin: false,
    },
  ];
  const ledger = () => replayLedger([fund(), entry("buy", "btc", "2", "100")]);
  it("computes unrealized P&L, position return and allocation including cash", () => {
    const s = valuePortfolio(ledger(), assets, [
      {
        assetId: "btc",
        price: "150",
        change24h: null,
        updatedAt: "2026-01-01T12:00:00Z",
        stale: false,
      },
    ]);
    expect(s.value).toBe("10100");
    expect(s.unrealizedPnl).toBe("100");
    expect(s.positions[0].returnPercent).toBe("50");
    expect(s.positions[0].allocation).toBe(percent("300", "10100"));
  });
  it("never treats missing quotes as zero price", () => {
    const s = valuePortfolio(ledger(), assets, []);
    expect(s.value).toBeNull();
    expect(s.unrealizedPnl).toBeNull();
    expect(s.positions[0].allocation).toBeNull();
    expect(s.knownValue).toBe("9800");
  });
  it("values an empty portfolio at zero", () => {
    expect(valuePortfolio(replayLedger([]), [], []).value).toBe("0");
  });
});
