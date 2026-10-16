// Provider fixtures wrap this boundary. Unhandled requests never reach live APIs.
const nativeFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(
    typeof input === "string" || input instanceof URL ? input : input.url,
  );
  if (
    [
      "api.coingecko.com",
      "api.openai.com",
      "api.telegram.org",
      "horizon.stellar.org",
      "mempool.space",
      "fred.stlouisfed.org",
    ].includes(url.hostname)
  )
    return Promise.resolve(
      new Response("Unmocked test provider request", { status: 503 }),
    );
  return nativeFetch(input, init);
};
