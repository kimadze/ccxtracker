import nextEnv from "@next/env";
import { telegramConfigured } from "../src/server/telegram/api";
import { registerTelegramWebhook } from "../src/server/telegram/setup";
nextEnv.loadEnvConfig(process.cwd());
if (!telegramConfigured())
  throw new Error(
    "Configure TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, TELEGRAM_WEBHOOK_SECRET and HTTPS BETTER_AUTH_URL first.",
  );
await registerTelegramWebhook();
console.log("Telegram webhook registered. No credentials were printed.");
