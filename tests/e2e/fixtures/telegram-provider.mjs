// Test server only. Never calls the real Telegram API.
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, options) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  if (url.startsWith("https://api.telegram.org/"))
    return new Response(
      JSON.stringify({ ok: true, result: { message_id: 1 } }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  return originalFetch(input, options);
};
