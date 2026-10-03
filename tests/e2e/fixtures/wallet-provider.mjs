// This provider interception is imported only by the isolated browser-test server.
const originalFetch = globalThis.fetch;
let btcCalls = 0;
globalThis.fetch = async (input, init) => {
  const url = new URL(
    typeof input === "string" || input instanceof URL ? input : input.url,
  );
  if (url.hostname === "mempool.space") {
    if (url.pathname.endsWith("/prices"))
      return Response.json({ USD: 60000, time: Math.floor(Date.now() / 1000) });
    if (url.pathname.includes("/address/")) {
      btcCalls++;
      if (btcCalls === 2) return new Response("", { status: 429 });
      return Response.json({
        address: decodeURIComponent(url.pathname.split("/").at(-1)),
        chain_stats: { funded_txo_sum: 150000000, spent_txo_sum: 50000000 },
        mempool_stats: { funded_txo_sum: 0, spent_txo_sum: 1000000 },
      });
    }
  }
  if (
    url.hostname === "api.coingecko.com" &&
    url.searchParams.get("ids") === "stellar"
  )
    return Response.json({
      stellar: { usd: 0.12, last_updated_at: Math.floor(Date.now() / 1000) },
    });
  if (url.hostname === "horizon.stellar.org") {
    if (url.pathname === "/ledgers")
      return Response.json({
        _embedded: { records: [{ base_reserve_in_stroops: 5000000 }] },
      });
    if (url.pathname.includes("/accounts/")) {
      const account = decodeURIComponent(url.pathname.split("/").at(-1));
      return Response.json({
        account_id: account,
        subentry_count: 1,
        num_sponsoring: 0,
        num_sponsored: 0,
        balances: [
          {
            asset_type: "native",
            balance: "1000.1234567",
            selling_liabilities: "5",
          },
          {
            asset_type: "credit_alphanum12",
            asset_code: "LONGTOKEN123",
            asset_issuer: account,
            balance: "9999999999.1234567",
          },
          {
            asset_type: "credit_alphanum4",
            asset_code: "SPAM",
            asset_issuer: account,
            balance: "100",
            is_authorized: false,
          },
        ],
      });
    }
  }
  return originalFetch(input, init);
};
