import { describe, it, expect } from "vitest";
import {
  validBitcoinAddress,
  validStellarAddress,
  walletInputSchema,
} from "@/server/wallet-validation";
import {
  parseBitcoinAccount,
  parseStellarAccount,
  fetchWalletSnapshot,
  type WalletFetch,
} from "@/server/wallet-provider";
const btc = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa";
const stellar = "GDI73WJ4SX7LOG3XZDJC3KCK6ED6E5NBYK2JUBQSPBCNNWEG3ZN7T75U";
const account = {
  account_id: stellar,
  subentry_count: 3,
  num_sponsored: 1,
  num_sponsoring: 2,
  balances: [
    {
      asset_type: "native",
      balance: "100.0000000",
      selling_liabilities: "2.0000000",
    },
    {
      asset_type: "credit_alphanum4",
      asset_code: "USDC",
      asset_issuer: stellar,
      balance: "5.0000000",
      is_authorized: false,
    },
  ],
};
describe("read-only wallet validation and accounting", () => {
  it("validates checksums, mainnet and public keys only", () => {
    expect(validStellarAddress(stellar)).toBe(true);
    expect(validStellarAddress(stellar.slice(0, -1) + "A")).toBe(false);
    expect(validStellarAddress("S" + stellar.slice(1))).toBe(false);
    expect(validBitcoinAddress(btc)).toBe(true);
    expect(validBitcoinAddress(btc.slice(0, -1) + "b")).toBe(false);
    expect(validBitcoinAddress("tb1qxyz")).toBe(false);
    expect(
      validBitcoinAddress("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4"),
    ).toBe(true);
    expect(
      validBitcoinAddress("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5"),
    ).toBe(false);
    expect(() =>
      walletInputSchema.parse({
        name: "test",
        network: "bitcoin",
        addresses: [btc, btc],
      }),
    ).toThrow();
    expect(() =>
      walletInputSchema.parse({
        name: "test",
        network: "stellar",
        addresses: [btc],
      }),
    ).toThrow();
  });
  it("separates confirmed BTC and signed mempool delta using exact satoshis", () => {
    const d = {
      address: btc,
      chain_stats: { funded_txo_sum: 123456789, spent_txo_sum: 23456789 },
      mempool_stats: { funded_txo_sum: 1, spent_txo_sum: 50000000 },
    };
    const a = parseBitcoinAccount(d, btc, "60000");
    expect(a.assets[0].quantity).toBe("1");
    expect(a.assets[0].value).toBe("60000");
    expect(a.pending).toBe("-0.49999999");
    expect(parseBitcoinAccount(d, btc, null).assets[0].value).toBeNull();
    expect(() =>
      parseBitcoinAccount({ ...d, address: "other" }, btc, "60000"),
    ).toThrow();
  });
  it("accounts for Stellar reserve sponsorship and selling liabilities without inventing token prices", () => {
    const a = parseStellarAccount(account, stellar, "0.1", "0.5");
    expect(a.reserve).toBe("3");
    expect(a.available).toBe("95");
    expect(a.assets[0].value).toBe("10");
    expect(a.assets[1].value).toBeNull();
    expect(a.assets[1].authorized).toBe(false);
    expect(a.assets[1].id).toContain(stellar);
    expect(
      parseStellarAccount(account, stellar, null, null).available,
    ).toBeNull();
  });
  it("marks unknown positive token values partial, excludes stale prices and only uses fixed GET origins", async () => {
    const calls: string[] = [];
    const fetcher: WalletFetch = async (url, init) => {
      calls.push(url);
      expect(init?.method).toBe("GET");
      if (url.includes("coingecko"))
        return Response.json({
          stellar: { usd: 0.1, last_updated_at: Math.floor(Date.now() / 1000) },
        });
      if (url.includes("/ledgers"))
        return Response.json({
          _embedded: { records: [{ base_reserve_in_stroops: 5000000 }] },
        });
      return Response.json(account);
    };
    const s = await fetchWalletSnapshot("stellar", [stellar], fetcher);
    expect(s.knownValue).toBe("10");
    expect(s.complete).toBe(false);
    expect(
      calls.every(
        (c) =>
          c.startsWith("https://horizon.stellar.org/") ||
          c.startsWith("https://api.coingecko.com/"),
      ),
    ).toBe(true);
    const stale: WalletFetch = async (url) =>
      url.includes("/prices")
        ? Response.json({ USD: 60000, time: 1 })
        : Response.json({
            address: btc,
            chain_stats: { funded_txo_sum: 100000000, spent_txo_sum: 0 },
            mempool_stats: { funded_txo_sum: 0, spent_txo_sum: 0 },
          });
    const b = await fetchWalletSnapshot("bitcoin", [btc], stale);
    expect(b.accounts[0].assets[0].price).toBeNull();
    expect(b.complete).toBe(false);
  });
  it("treats unfunded Stellar separately from provider failure", async () => {
    const fetcher: WalletFetch = async () => new Response("", { status: 404 });
    const a = await fetchWalletSnapshot("stellar", [stellar], fetcher);
    expect(a.accounts[0].state).toBe("unfunded");
    const fail: WalletFetch = async () => new Response("", { status: 429 });
    await expect(
      fetchWalletSnapshot("stellar", [stellar], fail),
    ).rejects.toThrow("WALLET_RATE_LIMIT");
  });
});
