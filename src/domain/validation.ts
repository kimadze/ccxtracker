import { z } from "zod";
import { decimal } from "./decimal";

export const amountSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s\u00a0]/g, "").replace(",", "."))
  .pipe(
    z
      .string()
      .regex(
        /^\d{1,24}(\.\d{1,18})?$/,
        "შეიყვანეთ რიცხვი, მაქსიმუმ 18 ათწილადი ნიშნით.",
      )
      .refine((v) => {
        try {
          return decimal(v).gte(0);
        } catch {
          return false;
        }
      }, "თანხა დასაშვებ ზღვარს აღემატება."),
  );
export const positiveAmount = amountSchema.refine(
  (v) => decimal(v).gt(0),
  "მნიშვნელობა უნდა იყოს 0-ზე მეტი.",
);
export const portfolioSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "პორტფელის სახელი აუცილებელია.")
    .max(60, "სახელი არ უნდა აღემატებოდეს 60 სიმბოლოს."),
});
export const idSchema = z.string().uuid("მონაცემების მისამართი არასწორია.");
export const transactionSchema = z
  .object({
    id: idSchema,
    portfolioId: idSchema,
    assetId: z.string().min(1, "აირჩიეთ აქტივი.").max(120),
    kind: z.enum(["buy", "sell", "deposit", "withdrawal", "fee"], {
      error: "აირჩიეთ ტრანზაქციის ტიპი.",
    }),
    quantity: positiveAmount,
    price: amountSchema.nullable(),
    fee: amountSchema,
    occurredAt: z
      .string()
      .datetime({ offset: true, error: "შეიყვანეთ სწორი თარიღი." })
      .refine(
        (v) => Date.parse(v) <= Date.now() + 60000,
        "სამომავლო ტრანზაქცია ჯერ ვერ ჩაიწერება.",
      ),
    notes: z.string().trim().max(2000, "შენიშვნა ზედმეტად გრძელია."),
  })
  .superRefine((value, ctx) => {
    if (
      (value.kind === "buy" || value.kind === "sell") &&
      (value.assetId === "USD" || !value.price || decimal(value.price).lte(0))
    )
      ctx.addIssue({
        code: "custom",
        path: ["price"],
        message: "შესყიდვისა და გაყიდვის ფასი უნდა იყოს 0-ზე მეტი.",
      });
  });
export type TransactionInput = z.infer<typeof transactionSchema>;
