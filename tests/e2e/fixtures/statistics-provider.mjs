// Loaded only by the isolated E2E server via --import, never by the application.
const nativeFetch = globalThis.fetch;
const fixture = (id, rank, change, price = 3000) => ({
  id,
  symbol: id === "bitcoin" ? "btc" : id,
  name:
    id === "bitcoin"
      ? "Bitcoin"
      : "ძალიან გრძელი ქართული აქტივის სახელის შემოწმება",
  image: null,
  market_cap_rank: rank,
  current_price: price,
  price_change_percentage_1h_in_currency: change === null ? null : -change,
  price_change_percentage_24h_in_currency: change,
  price_change_percentage_7d_in_currency: change === null ? null : change * 2,
  market_cap: 200000000,
  total_volume: 30000000,
  circulating_supply: 1000000,
  sparkline_in_7d: {
    price: Array.from(
      { length: 36 },
      (_, i) => price * (1 + Math.sin(i / 3) / 10),
    ),
  },
  last_updated: new Date().toISOString(),
});
const assets = [
  fixture("bitcoin", 1, 5),
  fixture("eth", 2, -9),
  fixture("sol", 3, 0),
  fixture("tiny", 4, -93.5, 0.000000000123),
  fixture("missing", 5, null),
  fixture("tether", 6, 0, 1),
];
globalThis.fetch = async (input, init) => {
  const url = new URL(
    typeof input === "string" || input instanceof URL ? input : input.url,
  );
  if (
    url.hostname === "api.coingecko.com" &&
    url.pathname === "/api/v3/coins/markets"
  ) {
    const ids = url.searchParams.get("ids")?.split(",");
    return Response.json(
      url.searchParams.get("category")
        ? [assets[5]]
        : ids
          ? assets.filter((asset) => ids.includes(asset.id))
          : assets,
    );
  }
  if (url.hostname === "api.coingecko.com" && url.pathname === "/api/v3/global")
    return Response.json({
      data: {
        total_market_cap: { usd: 2600000000000 },
        total_volume: { usd: 85000000000 },
        market_cap_percentage: { btc: 58.3, eth: 12.4 },
        updated_at: Math.floor(Date.now() / 1000),
      },
    });
  if (url.hostname === "fred.stlouisfed.org") {
    if (url.searchParams.get("id") === "DGS2")
      return new Response("unavailable", { status: 503 });
    const cpi = url.searchParams.get("id")?.includes("CPI");
    const rows = Array.from(
      { length: 30 },
      (_, i) =>
        `${new Date(Date.UTC(2024, i, 1)).toISOString().slice(0, 10)},${cpi ? 300 + i : 4 + Math.sin(i / 4)}`,
    );
    return new Response("DATE,VALUE\n" + rows.join("\n"));
  }
  return nativeFetch(input, init);
};
