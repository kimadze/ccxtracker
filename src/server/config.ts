import "server-only";
export function isConfigured() {
  return Boolean(process.env.DATABASE_URL && process.env.BETTER_AUTH_SECRET && process.env.BETTER_AUTH_URL && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
export function authConfig() {
  if (!isConfigured() || process.env.BETTER_AUTH_SECRET!.length < 32) throw new Error("AUTH_NOT_CONFIGURED");
  const baseURL = process.env.BETTER_AUTH_URL!;
  const url = new URL(baseURL);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:" && url.hostname !== "localhost") throw new Error("HTTPS_REQUIRED");
  return { baseURL, secret: process.env.BETTER_AUTH_SECRET!, clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! };
}
