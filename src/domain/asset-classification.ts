import type { Asset } from "./types";
// Reviewed CoinGecko identities, never symbol matches or an assumed $1 price.
// Sources: coingecko.com/en/coins/{id}. Extend only after verifying the identity.
export const usdStablecoinIds = [
  "tether",
  "usd-coin",
  "dai",
  "paypal-usd",
  "first-digital-usd",
] as const;
export function isKnownUsdStablecoin(providerId: string) {
  return (usdStablecoinIds as readonly string[]).includes(providerId);
}
export function classifyAsset<T extends Asset>(asset: T): T {
  return isKnownUsdStablecoin(asset.providerId)
    ? { ...asset, isStablecoin: true, category: "stablecoin" }
    : asset;
}
