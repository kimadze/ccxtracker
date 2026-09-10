import { z } from "zod";
import { amountSchema, idSchema, positiveAmount } from "./validation";
export const scenarioSchema = z
  .object({
    id: idSchema,
    portfolioId: idSchema,
    name: z
      .string()
      .trim()
      .min(1, "სცენარის სახელი აუცილებელია.")
      .max(80, "სახელი არ უნდა აღემატებოდეს 80 სიმბოლოს."),
    prices: z
      .array(
        z.object({ assetId: z.string().min(1).max(120), price: amountSchema }),
      )
      .max(200),
  })
  .refine(
    (v) => new Set(v.prices.map((p) => p.assetId)).size === v.prices.length,
    "სცენარში აქტივი არ უნდა განმეორდეს.",
  );
export const goalSchema = z.object({
  portfolioId: idSchema,
  target: positiveAmount,
  milestones: z.array(positiveAmount).max(12),
});
