import "server-only";

export function aiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** Fixed endpoint/model, bounded output, no persisted response or provider errors in logs. */
export async function lunaJson(
  instructions: string,
  input: unknown,
  schema: Record<string, unknown>,
  image?: string,
) {
  if (!aiConfigured()) throw new Error("AI_NOT_CONFIGURED");
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-6-luna",
        store: false,
        reasoning: { effort: "none" },
        max_output_tokens: 600,
        instructions,
        input: image
          ? [
              {
                role: "user",
                content: [
                  { type: "input_text", text: JSON.stringify(input) },
                  { type: "input_image", image_url: image, detail: "high" },
                ],
              },
            ]
          : JSON.stringify(input),
        text: {
          format: {
            type: "json_schema",
            name: "ccx_result",
            strict: true,
            schema,
          },
        },
      }),
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("AI_UNAVAILABLE");
    const body = await response.json();
    if (body.status !== "completed" || !Array.isArray(body.output))
      throw new Error("AI_UNAVAILABLE");
    const text = body.output
      .flatMap(
        (item: { content?: { type: string; text?: string }[] }) =>
          item.content ?? [],
      )
      .filter((item: { type: string }) => item.type === "output_text")
      .map((item: { text?: string }) => item.text ?? "")
      .join("");
    if (!text || text.length > 6000) throw new Error("AI_UNAVAILABLE");
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("AI_UNAVAILABLE");
  }
}
