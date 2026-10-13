import "server-only";
import { getDb } from "@/server/db";
import { aiUsage } from "@/server/db/schema";
import { decimal } from "@/domain/decimal";

export function aiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** Fixed endpoint/model, bounded output, no persisted response or provider errors in logs. */
export async function lunaJson(
  instructions: string,
  input: unknown,
  schema: Record<string, unknown>,
  image?: string,
  context?: { userId: string; feature: "text" | "screenshot" },
) {
  if (!aiConfigured()) throw new Error("AI_NOT_CONFIGURED");
  let usage:
    | {
        input_tokens?: number;
        output_tokens?: number;
        input_tokens_details?: { cached_tokens?: number };
      }
    | undefined;
  let succeeded = false;
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
    usage = body.usage;
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
    const result = JSON.parse(text) as unknown;
    succeeded = true;
    return result;
  } catch {
    throw new Error("AI_UNAVAILABLE");
  } finally {
    if (context) {
      const input = usage?.input_tokens,
        output = usage?.output_tokens;
      const cachedValue = usage?.input_tokens_details?.cached_tokens ?? 0;
      const cached = Number.isSafeInteger(cachedValue)
        ? Math.max(0, Math.min(cachedValue, input ?? 0))
        : 0;
      const valid =
        Number.isSafeInteger(input) &&
        Number.isSafeInteger(output) &&
        input! >= 0 &&
        output! >= 0;
      try {
        await getDb()
          .insert(aiUsage)
          .values({
            userId: context.userId,
            feature: context.feature,
            status: succeeded ? "success" : "failed",
            inputTokens: valid ? input : null,
            cachedTokens: valid ? cached : null,
            outputTokens: valid ? output : null,
            estimatedCost: valid
              ? decimal(input! - cached)
                  .mul("0.10")
                  .plus(decimal(cached).mul("0.01"))
                  .plus(decimal(output!).mul("0.50"))
                  .div(1000000)
                  .toFixed()
              : null,
          });
      } catch {
        console.warn("AI_USAGE_RECORD_FAILED");
      }
    }
  }
}
