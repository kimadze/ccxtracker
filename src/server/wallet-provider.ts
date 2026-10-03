import "server-only";
import { z } from "zod";
import { D, amount, decimal } from "@/domain/decimal";
import type {
  WalletAccount,
  WalletNetwork,
  WalletSnapshot,
} from "@/domain/wallet";

const nonnegative = z
  .string()
  .regex(/^\d+(\.\d+)?$/)
  .refine((v) => {
    try {
      return decimal(v).gte(0);
    } catch {
      return false;
    }
  });
const stats = z.object({
  funded_txo_sum: z.number().int().nonnegative().safe(),
  spent_txo_sum: z.number().int().nonnegative().safe(),
});
const btcSchema = z.object({
  address: z.string(),
  chain_stats: stats,
  mempool_stats: stats,
});
const stellarSchema = z.object({
  account_id: z.string(),
  subentry_count: z.number().int().nonnegative(),
  num_sponsoring: z.number().int().nonnegative().default(0),
  num_sponsored: z.number().int().nonnegative().default(0),
  balances: z
    .array(
      z.object({
        asset_type: z.enum([
          "native",
          "credit_alphanum4",
          "credit_alphanum12",
          "liquidity_pool_shares",
        ]),
        balance: nonnegative,
        asset_code: z.string().max(12).optional(),
        asset_issuer: z.string().optional(),
        liquidity_pool_id: z.string().optional(),
        selling_liabilities: nonnegative.default("0"),
        is_authorized: z.boolean().optional(),
      }),
    )
    .max(1000),
});
export type WalletFetch = (
  url: string,
  init?: RequestInit,
) => Promise<Response>;
async function request(url: string, fetcher: WalletFetch) {
  const res = await fetcher(url, {
    method: "GET",
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
    headers: { Accept: "application/json" },
  });
  if (!res.ok)
    throw new Error(
      res.status === 404
        ? "WALLET_NOT_FOUND"
        : res.status === 429
          ? "WALLET_RATE_LIMIT"
          : "WALLET_PROVIDER_FAILED",
    );
  const content = await res.text();
  if (content.length > 2_000_000) throw Error("WALLET_PROVIDER_FAILED");
  return JSON.parse(content) as unknown;
}
export function parseBitcoinAccount(
  data: unknown,
  address: string,
  price: string | null,
): WalletAccount {
  const d = btcSchema.parse(data);
  if (d.address.toLowerCase() !== address.toLowerCase())
    throw Error("WALLET_PROVIDER_FAILED");
  const confirmed = amount(
    decimal(d.chain_stats.funded_txo_sum)
      .minus(d.chain_stats.spent_txo_sum)
      .div(1e8),
  );
  if (decimal(confirmed).lt(0)) throw Error("WALLET_PROVIDER_FAILED");
  return {
    address,
    state: "active",
    pending: amount(
      decimal(d.mempool_stats.funded_txo_sum)
        .minus(d.mempool_stats.spent_txo_sum)
        .div(1e8),
    ),
    reserve: null,
    available: null,
    assets: [
      {
        id: "native",
        symbol: "BTC",
        issuer: null,
        quantity: confirmed,
        price,
        value: price === null ? null : amount(decimal(confirmed).mul(price)),
        authorized: true,
      },
    ],
  };
}
export function parseStellarAccount(
  data: unknown,
  address: string,
  price: string | null,
  baseReserve: string | null,
): WalletAccount {
  const d = stellarSchema.parse(data);
  if (d.account_id !== address) throw Error("WALLET_PROVIDER_FAILED");
  const native = d.balances.find((b) => b.asset_type === "native");
  if (!native) throw Error("WALLET_PROVIDER_FAILED");
  const reserve =
    baseReserve === null
      ? null
      : amount(
          decimal(baseReserve).mul(
            Math.max(
              0,
              2 + d.subentry_count + d.num_sponsoring - d.num_sponsored,
            ),
          ),
        );
  const available =
    reserve === null
      ? null
      : amount(
          D.max(
            0,
            decimal(native.balance)
              .minus(reserve)
              .minus(native.selling_liabilities),
          ),
        );
  const assets = d.balances.map((b) => {
    const isNative = b.asset_type === "native";
    if (
      !isNative &&
      b.asset_type !== "liquidity_pool_shares" &&
      (!b.asset_code || !b.asset_issuer)
    )
      throw Error("WALLET_PROVIDER_FAILED");
    if (b.asset_type === "liquidity_pool_shares" && !b.liquidity_pool_id)
      throw Error("WALLET_PROVIDER_FAILED");
    const tokenPrice = isNative ? price : null;
    return {
      id: isNative
        ? "native"
        : b.asset_type === "liquidity_pool_shares"
          ? `pool:${b.liquidity_pool_id}`
          : `${b.asset_code}:${b.asset_issuer}`,
      symbol: isNative
        ? "XLM"
        : b.asset_type === "liquidity_pool_shares"
          ? "LP"
          : b.asset_code!,
      issuer: b.asset_issuer ?? b.liquidity_pool_id ?? null,
      quantity: b.balance,
      price: tokenPrice,
      value: decimal(b.balance).isZero()
        ? "0"
        : tokenPrice === null
          ? null
          : amount(decimal(b.balance).mul(tokenPrice)),
      authorized: b.is_authorized !== false,
    };
  });
  return {
    address,
    state: "active",
    pending: null,
    reserve,
    available,
    assets,
  };
}
export async function fetchWalletSnapshot(
  network: WalletNetwork,
  addresses: string[],
  fetcher: WalletFetch = fetch,
): Promise<WalletSnapshot> {
  let price: string | null = null,
    priceAt: string | null = null,
    baseReserve: string | null = null;
  if (network === "bitcoin") {
    try {
      const p = z
        .object({
          USD: z.number().positive().finite(),
          time: z.number().int().positive(),
        })
        .parse(await request("https://mempool.space/api/v1/prices", fetcher));
      if (Math.abs(Date.now() - p.time * 1000) < 15 * 60000) {
        price = amount(p.USD);
        priceAt = new Date(p.time * 1000).toISOString();
      }
    } catch {
      /* Missing prices never become zero. */
    }
  } else {
    const results = await Promise.allSettled([
      request(
        "https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd&include_last_updated_at=true",
        fetcher,
      ),
      request(
        "https://horizon.stellar.org/ledgers?order=desc&limit=1",
        fetcher,
      ),
    ]);
    if (results[0].status === "fulfilled") {
      try {
        const p = z
          .object({
            stellar: z.object({
              usd: z.number().positive().finite(),
              last_updated_at: z.number().int().positive(),
            }),
          })
          .parse(results[0].value).stellar;
        if (Math.abs(Date.now() - p.last_updated_at * 1000) < 15 * 60000) {
          price = amount(p.usd);
          priceAt = new Date(p.last_updated_at * 1000).toISOString();
        }
      } catch {}
    }
    if (results[1].status === "fulfilled") {
      try {
        const p = z
          .object({
            _embedded: z.object({
              records: z
                .array(
                  z.object({
                    base_reserve_in_stroops: z
                      .number()
                      .int()
                      .nonnegative()
                      .safe(),
                  }),
                )
                .min(1),
            }),
          })
          .parse(results[1].value);
        baseReserve = amount(
          decimal(p._embedded.records[0].base_reserve_in_stroops).div(1e7),
        );
      } catch {}
    }
  }
  const accounts: WalletAccount[] = [];
  // Bounded pairs keep public APIs usable and the refresh within a server action timeout.
  for (let i = 0; i < addresses.length; i += 2) {
    accounts.push(
      ...(await Promise.all(
        addresses.slice(i, i + 2).map(async (address) => {
          const url =
            network === "bitcoin"
              ? `https://mempool.space/api/address/${encodeURIComponent(address)}`
              : `https://horizon.stellar.org/accounts/${encodeURIComponent(address)}`;
          try {
            const data = await request(url, fetcher);
            return network === "bitcoin"
              ? parseBitcoinAccount(data, address, price)
              : parseStellarAccount(data, address, price, baseReserve);
          } catch (error) {
            if (
              network === "stellar" &&
              error instanceof Error &&
              error.message === "WALLET_NOT_FOUND"
            )
              return {
                address,
                state: "unfunded" as const,
                assets: [],
                pending: null,
                reserve: null,
                available: null,
              };
            throw error;
          }
        }),
      )),
    );
  }
  const assets = accounts.flatMap((a) => a.assets);
  return {
    accounts,
    fetchedAt: new Date().toISOString(),
    priceAt,
    knownValue: amount(assets.reduce((s, a) => s.plus(a.value ?? 0), new D(0))),
    complete: assets.every((a) => a.value !== null),
  };
}
