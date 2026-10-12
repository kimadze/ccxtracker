import { z } from "zod";
import { amountSchema as amount, positiveAmount } from "./validation";

export const aiTransactionSchema = z
  .object({
    kind: z
      .enum(["buy", "sell", "deposit", "withdrawal", "fee", "airdrop"])
      .nullable(),
    symbol: z.string().max(32).nullable(),
    quantity: z.string().max(80).nullable(),
    price: z.string().max(80).nullable(),
    fee: z.string().max(80).nullable(),
    day: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    issues: z.array(z.string().max(160)).max(3),
  })
  .strict();

export function validateAiTransaction(input: unknown) {
  const draft = aiTransactionSchema.parse(input);
  if (
    draft.issues.length ||
    !draft.kind ||
    !draft.symbol ||
    !positiveAmount.safeParse(draft.quantity).success
  )
    throw new Error(
      "დააზუსტე მოქმედება, აქტივი და რაოდენობა. ერთ ჯერზე მხოლოდ ერთი ტრანზაქცია აღწერე.",
    );
  if (draft.price !== null && !amount.safeParse(draft.price).success)
    throw new Error("ფასი ვერ განისაზღვრა. მიუთითე ერთეულის ფასი USD-ში.");
  if (
    ["buy", "sell", "airdrop"].includes(draft.kind) &&
    !positiveAmount.safeParse(draft.price).success
  )
    throw new Error("მიუთითე ერთეულის ფასი USD-ში.");
  if (draft.fee !== null && !amount.safeParse(draft.fee).success)
    throw new Error("საკომისიო ვერ განისაზღვრა.");
  if (
    draft.day &&
    (Number.isNaN(Date.parse(draft.day)) ||
      new Date(draft.day).toISOString().slice(0, 10) !== draft.day)
  )
    throw new Error("თარიღი ვერ განისაზღვრა.");
  const symbol = draft.symbol.trim().toUpperCase();
  if (symbol === "USD" && ["buy", "sell", "airdrop"].includes(draft.kind))
    throw new Error("USD-ისთვის აირჩიე შეტანა ან გატანა.");
  return { ...draft, kind: draft.kind, symbol, quantity: draft.quantity! };
}

export const aiTransactionJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    kind: {
      type: ["string", "null"],
      enum: ["buy", "sell", "deposit", "withdrawal", "fee", "airdrop", null],
    },
    symbol: { type: ["string", "null"] },
    quantity: { type: ["string", "null"] },
    price: { type: ["string", "null"] },
    fee: { type: ["string", "null"] },
    day: { type: ["string", "null"] },
    issues: { type: "array", items: { type: "string" } },
  },
  required: ["kind", "symbol", "quantity", "price", "fee", "day", "issues"],
};
