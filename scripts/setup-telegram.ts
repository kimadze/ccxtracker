import nextEnv from "@next/env";
import {
  telegramCall,
  appOrigin,
  telegramConfigured,
} from "../src/server/telegram/api";
nextEnv.loadEnvConfig(process.cwd());
if (!telegramConfigured())
  throw new Error(
    "Configure TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, TELEGRAM_WEBHOOK_SECRET and HTTPS BETTER_AUTH_URL first.",
  );
await telegramCall("setWebhook", {
  url: `${appOrigin()}/api/telegram/webhook`,
  secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
  allowed_updates: ["message"],
  max_connections: 5,
});
console.log("Telegram webhook registered. No credentials were printed.");
