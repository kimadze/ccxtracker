export type AdminTone =
  "success" | "info" | "warning" | "error" | "neutral" | "primary";
export type AdminStatus = {
  label: string;
  tone: AdminTone;
  pending?: boolean;
  detail?: string;
};

export function deliveryStatus(
  row: {
    sentAt: Date | null;
    createdAt: Date;
    nextAttemptAt: Date;
    attempts: number;
    lastError: string | null;
  },
  now: Date,
): AdminStatus {
  if (row.sentAt) return { label: "გაგზავნილია", tone: "success" };
  if (["BOT_BLOCKED", "TELEGRAM_403"].includes(row.lastError ?? ""))
    return {
      label: "ბოტი დაბლოკილია",
      tone: "error",
      detail:
        "მომხმარებელმა Telegram-ში ბოტის ბლოკი უნდა მოხსნას და კავშირი გადაამოწმოს.",
    };
  if (["CANCELLED", "PREFERENCES_CHANGED"].includes(row.lastError ?? ""))
    return {
      label: "გაუქმებულია",
      tone: "neutral",
      detail:
        "კავშირი, პარამეტრები ან ალერტის პირობები შეიცვალა. ეს ჩანაწერი აღარ გაიგზავნება.",
    };
  if (
    row.lastError === "EXPIRED" ||
    now.getTime() - row.createdAt.getTime() > 6 * 3600000
  )
    return {
      label: "ვადა გასულია",
      tone: "neutral",
      detail: "ჩანაწერი ძველია და ხელახლა აღარ გაიგზავნება.",
    };
  if (row.lastError) {
    const detail =
      row.lastError === "TELEGRAM_429"
        ? "Telegram-ის მოთხოვნების ლიმიტი ამოიწურა. შემდეგი ცდა მითითებული დროის შემდეგ იქნება შესაძლებელი."
        : row.lastError === "TELEGRAM_401"
          ? "Telegram-ის ბოტის გასაღები არ მიიღება. გადაამოწმე TELEGRAM_BOT_TOKEN Vercel-ში."
          : row.lastError === "TELEGRAM_400"
            ? "Telegram-მა მოთხოვნა ვერ მიიღო. გადაამოწმე ბოტის კავშირი და შეტყობინების ფორმატი."
            : "გაგზავნა ვერ დადასტურდა. სერვისი ან ქსელი შეიძლება დროებით მიუწვდომელი იყოს.";
    return { label: "გაგზავნა ვერ მოხერხდა", tone: "error", detail };
  }
  if (row.attempts >= 8)
    return {
      label: "გაგზავნა შეჩერებულია",
      tone: "error",
      detail:
        "გაგზავნა არ დადასტურებულა და ავტომატური ცდები შეჩერებულია. გადაამოწმე Telegram-ის კავშირი.",
    };
  return {
    label: row.attempts ? "ხელახალი ცდა დაგეგმილია" : "რიგშია",
    tone: "warning",
    pending: true,
  };
}

export function adminErrorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "ADMIN_PROTECTED")
    return "ადმინისტრატორის ან საკუთარი ანგარიშის წვდომას ვერ შეაჩერებ.";
  if (code === "RETRY_UNAVAILABLE")
    return "ხელახალი ცდა აღარ არის ხელმისაწვდომი: ჩანაწერი გაიგზავნა, გაუქმდა, ვადა გაუვიდა ან უკვე ელოდება შემდეგ ცდას. განაახლე სია.";
  if (error instanceof Error && error.name === "ZodError")
    return "გადაამოწმე ველები: მომხმარებლის ლიმიტი უნდა იყოს 1–100, საერთო ლიმიტი — 1–5000.";
  return "მოქმედება ვერ შესრულდა. განაახლე გვერდი და სცადე ხელახლა. განმეორებისას გადაამოწმე სერვერისა და ბაზის მდგომარეობა.";
}
