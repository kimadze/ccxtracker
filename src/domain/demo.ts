import { replayLedger } from "./ledger";
import { valuePortfolio } from "./valuation";
import type { Asset, LedgerEntry, Quote } from "./types";

/** Public illustrative fixture. Never read by authenticated portfolio services. */
export const demoAssets: Asset[] = [
  {
    id: "bitcoin",
    providerId: "bitcoin",
    symbol: "BTC",
    name: "Bitcoin",
    isStablecoin: false,
  },
  {
    id: "ethereum",
    providerId: "ethereum",
    symbol: "ETH",
    name: "Ethereum",
    isStablecoin: false,
  },
  {
    id: "solana",
    providerId: "solana",
    symbol: "SOL",
    name: "Solana",
    isStablecoin: false,
  },
  {
    id: "chainlink",
    providerId: "chainlink",
    symbol: "LINK",
    name: "Chainlink",
    isStablecoin: false,
  },
  {
    id: "usd-coin",
    providerId: "usd-coin",
    symbol: "USDC",
    name: "USDC",
    isStablecoin: true,
  },
];
const demoPrices = ["97420", "3248", "182.65", "22.84", "0.9998"];
const demoChanges = ["2.34", "1.82", "-1.24", "3.61", "0.01"];
export const demoQuotes: Quote[] = demoAssets.map((a, i) => ({
  assetId: a.id,
  price: demoPrices[i],
  change24h: demoChanges[i],
  updatedAt: "2026-09-10T08:00:00.000Z",
  stale: false,
}));
const tuples = [
  ["bitcoin", "0.24", "68400"],
  ["ethereum", "3.5", "2480"],
  ["solana", "36", "142"],
  ["chainlink", "120", "25.4"],
  ["usd-coin", "3200", "1"],
];
const demoEntries: LedgerEntry[] = [
  {
    id: "fund",
    assetId: "USD",
    kind: "deposit",
    quantity: "40000",
    price: null,
    fee: "0",
    occurredAt: "2026-08-01T08:00:00.000Z",
    sequence: 0,
  },
  ...tuples.map(([assetId, quantity, price], i): LedgerEntry => ({
    id: String(i),
    assetId,
    quantity,
    price,
    kind: "buy",
    fee: "0",
    occurredAt: "2026-08-01T09:00:00.000Z",
    sequence: i + 1,
  })),
];
export const demoSummary = valuePortfolio(
  replayLedger(demoEntries),
  demoAssets,
  demoQuotes,
);
export const demoHistory = [
  40000,
  40840,
  40320,
  41500,
  40920,
  42120,
  41800,
  43300,
  42900,
  42300,
  43700,
  44100,
  43400,
  43900,
  44980,
  44100,
  45400,
  45000,
  46050,
  45200,
  45700,
  46950,
  46100,
  47500,
  46900,
  48200,
  47300,
  48900,
  48000,
  Number(demoSummary.value),
].map((value, i) => ({
  capturedAt: new Date(Date.UTC(2026, 7, i + 12)).toISOString(),
  value: String(value),
  cash: demoSummary.cash,
  realizedPnl: "0",
  unrealizedPnl: String(value - 40000),
}));
