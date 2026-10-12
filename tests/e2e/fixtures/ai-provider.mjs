// Isolated tests only: never contacts OpenAI.
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, options) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  if (url === "https://api.openai.com/v1/responses") {
    const request = JSON.parse(options.body);
    const image = Array.isArray(request.input);
    const data = image ? {} : JSON.parse(request.input);
    const value =
      data.text || image
        ? {
            kind: "sell",
            symbol: image ? "XLM/USDT" : "XLM",
            quantity: "500",
            price: "0.12",
            fee: null,
            day: null,
            issues: [],
            ...(image
              ? {
                  status: "filled",
                  currency: "USDT",
                  feeCurrency: null,
                  executedQuantity: "500",
                  executedPrice: "0.12",
                  dateText: "10-12 00:55:47",
                  multiple: false,
                }
              : {}),
          }
        : { focus: "performance" };
    return new Response(
      JSON.stringify({
        status: "completed",
        output: [
          { content: [{ type: "output_text", text: JSON.stringify(value) }] },
        ],
      }),
      { headers: { "content-type": "application/json" } },
    );
  }
  return originalFetch(input, options);
};
