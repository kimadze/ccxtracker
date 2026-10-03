export type WalletNetwork = "stellar" | "bitcoin";
export interface WalletAsset {
  id: string;
  symbol: string;
  issuer: string | null;
  quantity: string;
  price: string | null;
  value: string | null;
  authorized: boolean;
}
export interface WalletAccount {
  address: string;
  assets: WalletAsset[];
  state: "active" | "unfunded";
  pending: string | null;
  reserve: string | null;
  available: string | null;
}
export interface WalletSnapshot {
  accounts: WalletAccount[];
  fetchedAt: string;
  priceAt: string | null;
  knownValue: string;
  complete: boolean;
}
export interface WalletConfig {
  addresses: string[];
}
export function walletSnapshotStale(fetchedAt: string, now = Date.now()) {
  return now - Date.parse(fetchedAt) > 15 * 60000;
}
