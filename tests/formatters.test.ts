import { expect, it } from "vitest";
import { compactMoney, dateTime, money, percentage, quantity } from "@/lib/formatters";
import { userError } from "@/server/errors";
import { z } from "zod";
it("formats Georgian dates and decimals consistently without browser locale fallback", () => {
  expect(money("1234.5")).toBe("$1\u00a0234,50");
  expect(money("-307.2")).toBe("-$307,20");
  expect(dateTime("2026-09-10T23:15:00Z")).toBe("11 სექ 2026, 03:15");
  expect(percentage("12.25", true)).toBe("+12,25%");
  expect(quantity("0.000000000000000001")).toBe("0,000000000000000001");
  expect(compactMoney("3840000000000")).toBe("$3,84 ტრილ.");
  expect(compactMoney("142000000000")).toBe("$142 მლრდ");
});
it("never exposes default English validation errors", () => {
  const result = z.string().safeParse(123);
  expect(userError(result.error)).toBe("შეყვანილი მონაცემები არასწორია.");
});
