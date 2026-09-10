export type TransactionKind = "buy" | "sell" | "deposit" | "withdrawal" | "fee";
export interface LedgerEntry {
  id: string;
  assetId: string;
  kind: TransactionKind;
  quantity: string;
  price: string | null;
  fee: string;
  occurredAt: string;
  sequence: number;
  notes?: string;
}
export interface Holding {
  assetId: string;
  quantity: string;
  costBasis: string | null;
  averagePrice: string | null;
  realizedPnl: string | null;
}
export interface LedgerResult {
  holdings: Holding[];
  cash: string;
  contributions: string | null;
  withdrawals: string | null;
  cashFees: string;
  realizedPnl: string | null;
}
export interface Asset {
  id: string;
  symbol: string;
  name: string;
  providerId: string;
  isStablecoin: boolean;
  category?: string;
}
export interface Quote {
  assetId: string;
  price: string;
  change24h: string | null;
  updatedAt: string;
  stale: boolean;
}
export interface ValuedPosition extends Holding {
  asset: Asset;
  quote: Quote | null;
  value: string | null;
  unrealizedPnl: string | null;
  returnPercent: string | null;
  allocation: string | null;
}
export interface PortfolioSummary {
  positions: ValuedPosition[];
  cash: string;
  value: string | null;
  knownValue: string;
  costBasis: string | null;
  realizedPnl: string | null;
  unrealizedPnl: string | null;
  totalPnl: string | null;
  contributions: string | null;
  withdrawals: string | null;
  reserve: string;
  complete: boolean;
  stale: boolean;
}
