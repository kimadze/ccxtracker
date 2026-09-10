import { z } from "zod";
import { amountSchema, idSchema, positiveAmount } from "./validation";
import { decimal } from "./decimal";
export const exitPlanSchema = z.object({
  portfolioId: idSchema, assetId: z.string().min(1).max(120),
  feePercent: amountSchema.refine(v => decimal(v).lt(100), "საკომისიო უნდა იყოს 100%-ზე ნაკლები."),
  levels: z.array(z.object({ price: positiveAmount, percentage: positiveAmount.refine(v => decimal(v).lte(100), "წილი არ უნდა აღემატებოდეს 100%-ს.") })).min(1).max(12),
});
export const journalSchema = z.object({
  portfolioId: idSchema, assetId: z.string().min(1).max(120),
  thesis: z.string().trim().max(10000, "ტექსტი არ უნდა აღემატებოდეს 10 000 სიმბოლოს."),
  entryReason: z.string().trim().max(5000), catalysts: z.string().trim().max(5000), invalidation: z.string().trim().max(5000),
  targets: z.string().trim().max(2000), conviction: z.enum(["low", "medium", "high"]), horizon: z.string().trim().max(200), notes: z.string().trim().max(10000),
});
