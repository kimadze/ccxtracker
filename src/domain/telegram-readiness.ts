export const telegramReadinessLabels = {
  ready: "Telegram მზადაა",
  disconnected: "Telegram არ არის დაკავშირებული",
  blocked: "ბოტი დაბლოკილია",
  "portfolio-disabled": "პორტფელი არ არის არჩეული",
  "sell-disabled": "გაყიდვის შეტყობინებები გამორთულია",
} as const;
export function takeProfitDeliveryReadiness(
  connection:
    | {
        connected?: boolean;
        chatId?: string | null;
        lastError?: string | null;
        portfolioIds: string[];
        sellEnabled: boolean;
      }
    | null
    | undefined,
  portfolioId: string,
): keyof typeof telegramReadinessLabels {
  if (!connection || !(connection.connected ?? Boolean(connection.chatId)))
    return "disconnected";
  if (connection.lastError === "BOT_BLOCKED") return "blocked";
  if (!connection.portfolioIds.includes(portfolioId))
    return "portfolio-disabled";
  if (!connection.sellEnabled) return "sell-disabled";
  return "ready";
}
