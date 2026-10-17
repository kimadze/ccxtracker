import { expect, it } from "vitest";
import { walletSnapshotStale, type WalletSnapshot } from "@/domain/wallet";
import { closedPosition, valuePortfolio } from "@/domain/valuation";
import { replayLedger } from "@/domain/ledger";
import type { LedgerEntry } from "@/domain/types";
import { investableValue } from "@/domain/portfolio-segments";

it("classifies legacy stablecoin metadata while using the actual depegged quote", () => {
  const asset = {
    id: "dai",
    providerId: "dai",
    symbol: "DAI",
    name: "Dai",
    isStablecoin: false,
    category: "other",
  };
  const ledger = replayLedger([
    {
      id: "dai-deposit",
      assetId: "dai",
      kind: "deposit",
      quantity: "100",
      price: "1",
      fee: "0",
      occurredAt: "2026-10-01T00:00:00Z",
      sequence: 1,
    },
  ]);
  const summary = valuePortfolio(
    ledger,
    [asset],
    [
      {
        assetId: "dai",
        price: "0.98",
        change24h: null,
        updatedAt: new Date().toISOString(),
        stale: false,
      },
    ],
  );
  expect(summary.liquidity).toBe("98");
  expect(summary.stablecoinValue).toBe("98");
  expect(investableValue(summary)).toBe("0");
  expect(asset.isStablecoin).toBe(false);
});

it("keeps realized results for a closed position without valuing it as an open holding", () => {
  const asset = {
    id: "btc",
    providerId: "bitcoin",
    symbol: "BTC",
    name: "Bitcoin",
    isStablecoin: false,
  };
  const entries: LedgerEntry[] = [
    {
      id: "deposit",
      assetId: "btc",
      kind: "deposit",
      quantity: "10",
      price: "10",
      fee: "0",
      occurredAt: "2026-10-01T00:00:00Z",
      sequence: 1,
    },
    {
      id: "sale",
      assetId: "btc",
      kind: "sell",
      quantity: "10",
      price: "15",
      fee: "2",
      occurredAt: "2026-10-02T00:00:00Z",
      sequence: 2,
    },
  ];
  const ledger = replayLedger(entries);
  expect(closedPosition(ledger, [asset], "btc")).toMatchObject({
    quantity: "0",
    value: "0",
    realizedPnl: "48",
    unrealizedPnl: "0",
    returnPercent: null,
  });
  expect(valuePortfolio(ledger, [asset], []).positions).toEqual([]);
  expect(closedPosition(ledger, [asset], "unowned")).toBeNull();
  expect(
    closedPosition(replayLedger(entries.slice(0, 1)), [asset], "btc"),
  ).toBeNull();
  const unknown = replayLedger([{ ...entries[0], price: null }, entries[1]]);
  expect(closedPosition(unknown, [asset], "btc")?.realizedPnl).toBeNull();
});

it("checks both wallet balance and quote age, keeping missing prices separate", () => {
  const now = Date.parse("2026-10-17T00:00:00Z");
  const snapshot: WalletSnapshot = {
    fetchedAt: new Date(now).toISOString(),
    priceAt: new Date(now - 3600000).toISOString(),
    knownValue: "10",
    complete: true,
    accounts: [
      {
        address: "test",
        state: "active",
        pending: null,
        reserve: null,
        available: null,
        assets: [
          {
            id: "native",
            symbol: "XLM",
            issuer: null,
            quantity: "100",
            price: "0.1",
            value: "10",
            authorized: true,
          },
        ],
      },
    ],
  };
  expect(walletSnapshotStale(snapshot, now)).toBe(true);
  const fresh = { ...snapshot, priceAt: snapshot.fetchedAt };
  expect(walletSnapshotStale(fresh, now)).toBe(false);
  expect(walletSnapshotStale(fresh, now + 16 * 60000)).toBe(true);
  expect(walletSnapshotStale({ ...fresh, fetchedAt: "invalid" }, now)).toBe(
    true,
  );
  expect(walletSnapshotStale({ ...fresh, priceAt: null }, now)).toBe(true);
  expect(
    walletSnapshotStale(
      { ...fresh, priceAt: new Date(now + 120000).toISOString() },
      now,
    ),
  ).toBe(true);
  expect(
    walletSnapshotStale(
      {
        ...fresh,
        priceAt: null,
        complete: false,
        accounts: [
          {
            ...fresh.accounts[0],
            assets: [
              { ...fresh.accounts[0].assets[0], price: null, value: null },
            ],
          },
        ],
      },
      now,
    ),
  ).toBe(false);
});
