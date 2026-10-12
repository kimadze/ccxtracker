import { z } from "zod";
import {
  aiTransactionSchema,
  aiTransactionJsonSchema,
  validateAiTransaction,
} from "./ai-transaction";
import { positiveAmount } from "./validation";

const metadata = {
  status: z.enum([
    "filled",
    "completed",
    "canceled",
    "cancelled",
    "rejected",
    "expired",
    "open",
    "pending",
    "partially_filled",
    "unknown",
  ]),
  currency: z.string().max(16).nullable(),
  feeCurrency: z.string().max(16).nullable(),
  executedQuantity: z.string().max(80).nullable(),
  executedPrice: z.string().max(80).nullable(),
  dateText: z.string().max(100).nullable(),
  multiple: z.boolean(),
};
export const screenshotExtractionSchema = aiTransactionSchema.extend(metadata);
export type ScreenshotExtraction = z.infer<typeof screenshotExtractionSchema>;
export const screenshotJsonSchema = {
  ...aiTransactionJsonSchema,
  properties: {
    ...aiTransactionJsonSchema.properties,
    status: { type: "string", enum: metadata.status.options },
    currency: { type: ["string", "null"] },
    feeCurrency: { type: ["string", "null"] },
    executedQuantity: { type: ["string", "null"] },
    executedPrice: { type: ["string", "null"] },
    dateText: { type: ["string", "null"] },
    multiple: { type: "boolean" },
  },
  required: [...aiTransactionJsonSchema.required, ...Object.keys(metadata)],
};
export function reviewScreenshot(input: unknown) {
  const value = screenshotExtractionSchema.parse(input);
  const symbol = value.symbol?.trim().toUpperCase() ?? null;
  const pair = symbol?.match(/^([^/\s]+)\s*\/\s*([A-Z0-9]{2,16})$/);
  const currency = value.currency?.trim().toUpperCase() ?? null;
  const currencyConflict = Boolean(pair && currency && pair[2] !== currency);
  if (value.multiple) throw new Error("ამოჭერი მხოლოდ ერთი ტრანზაქცია.");
  const completed = ["filled", "completed"].includes(value.status);
  const trade = value.kind === "buy" || value.kind === "sell";
  const execution =
    positiveAmount.safeParse(value.executedQuantity).success &&
    positiveAmount.safeParse(value.executedPrice).success;
  if (!completed && (!trade || !execution)) {
    throw new Error(
      ["canceled", "cancelled", "rejected", "expired"].includes(value.status)
        ? "ორდერი არ შესრულებულა."
        : "შესრულებული ნაწილი მკაფიოდ არ ჩანს. ორდერი ტრანზაქციად ვერ დაემატება.",
    );
  }
  return {
    ...value,
    symbol: pair ? pair[1] : symbol,
    currency: currencyConflict ? null : (currency ?? pair?.[2] ?? null),
    issues: currencyConflict
      ? [
          ...value.issues,
          "წყვილისა და ფასის ვალუტები განსხვავდება; ფასი დააზუსტე USD-ში.",
        ]
      : value.issues,
    feeCurrency: value.feeCurrency?.toUpperCase() ?? null,
    quantity: trade
      ? (value.executedQuantity ?? (completed ? value.quantity : null))
      : value.quantity,
    price: trade
      ? (value.executedPrice ?? (completed ? value.price : null))
      : value.price,
    partial: !completed,
  };
}
export function confirmScreenshot(
  extraction: ReturnType<typeof reviewScreenshot>,
  fields: {
    kind: string;
    quantity: string;
    price: string;
    fee: string;
    day: string;
  },
  confirmed: boolean,
  settlementRate: string,
) {
  if (!confirmed)
    throw new Error(
      "გადაამოწმე შესრულებული მონაცემები და დაადასტურე მონახაზი.",
    );
  const stable =
    ["USDT", "USDC"].includes(extraction.currency ?? "") &&
    ["buy", "sell"].includes(fields.kind);
  const parsedRate = positiveAmount.safeParse(settlementRate);
  if (stable && !parsedRate.success)
    throw new Error("მიუთითე USD კურსი, 0-ზე მეტი.");
  const rate = stable && parsedRate.success ? parsedRate.data : "1";
  if (!fields.day) throw new Error("დააზუსტე ტრანზაქციის თარიღი.");
  const draft = validateAiTransaction({
    kind: fields.kind || null,
    symbol: extraction.symbol,
    quantity: fields.quantity || null,
    price: fields.price || null,
    fee: fields.fee.trim() || "0",
    day: fields.day,
    issues: [],
  });
  return {
    ...draft,
    settlementAssetId: stable
      ? extraction.currency === "USDT"
        ? "tether"
        : "usd-coin"
      : "USD",
    settlementRate: rate,
  };
}
