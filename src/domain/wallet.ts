import { decimal } from "./decimal";
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
export function walletSnapshotStale(
  snapshot: WalletSnapshot,
  now = Date.now(),
) {
  const expired = (timestamp: string | null) => {
    const time = timestamp ? Date.parse(timestamp) : NaN;
    return (
      !Number.isFinite(time) || now - time > 15 * 60000 || time > now + 60000
    );
  };
  const pricedBalance = snapshot.accounts.some((account) =>
    account.assets.some(
      (asset) => asset.price !== null && decimal(asset.quantity).gt(0),
    ),
  );
  return (
    expired(snapshot.fetchedAt) || (pricedBalance && expired(snapshot.priceAt))
  );
}
