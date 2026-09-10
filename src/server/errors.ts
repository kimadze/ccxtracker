import { ZodError } from "zod";
const errors: Record<string, string> = {
  INVALID_ALLOCATION:
    "მიზნობრივი წილების ჯამი უნდა იყოს 100%. აქტივი არ უნდა განმეორდეს.",
  INVALID_CAPITAL:
    "კაპიტალი უნდა იყოს არაუარყოფითი თანხა, მაქსიმუმ ორი ათწილადი ნიშნით.",
  CUSTOM_BUDGET_MISMATCH:
    "განაწილებული თანხების ჯამი უნდა უდრიდეს დამატებით კაპიტალს.",
  INVALID_PLAN:
    "გადაამოწმეთ გეგმა: ფასები უნდა იზრდებოდეს, რაოდენობები და წილები კი დასაშვებ ფარგლებში იყოს.",
  EXIT_EXCEEDS_HOLDINGS: "გაყიდვის წილების ჯამი არ უნდა აღემატებოდეს 100%-ს.",
  UNKNOWN_BASIS: "ამ გამოთვლისთვის საჭიროა პოზიცია ცნობილი თვითღირებულებით.",
  INSUFFICIENT_CASH:
    "თანხის ნაშთი არასაკმარისია. ჯერ დაამატეთ თანხის შეტანა შესაბამისი თარიღით.",
  INSUFFICIENT_HOLDINGS:
    "ამ თარიღისთვის აქტივის რაოდენობა არასაკმარისია. გადაამოწმეთ ტრანზაქციების ისტორია.",
  INVALID_TRANSACTION: "ტრანზაქციის მონაცემები არასწორია.",
  RESOURCE_NOT_FOUND: "მონაცემები ვერ მოიძებნა ან მათზე წვდომა არ გაქვთ.",
  STALE_REVISION:
    "პორტფელი სხვა მოქმედებით განახლდა. განაახლეთ გვერდი და სცადეთ ხელახლა.",
  UNKNOWN_ASSET: "აქტივი ვერ მოიძებნა. აირჩიეთ აქტივი სიიდან.",
  MARKET_NOT_CONFIGURED: "აქტივების ძიება დროებით მიუწვდომელია.",
};
export function userError(error: unknown) {
  if (error instanceof ZodError) {
    const message = error.issues[0]?.message;
    return message && /[\u10a0-\u10ff]/.test(message)
      ? message
      : "შეყვანილი მონაცემები არასწორია.";
  }
  if (error instanceof Error && errors[error.message])
    return errors[error.message];
  console.error(
    "Portfolio operation failed",
    error instanceof Error ? error.name : "UnknownError",
  );
  return "მოქმედება ვერ შესრულდა. სცადეთ ხელახლა.";
}
export type ActionResult =
  { ok: true; id?: string } | { ok: false; error: string };
