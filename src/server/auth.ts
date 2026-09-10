import "server-only";
import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "./db";
import { users, sessions, accounts, verifications, rateLimits } from "./db/schema";
import { authConfig, isConfigured } from "./config";

function createAuth() {
  const config = authConfig();
  return betterAuth({
    appName: "Crypto Collective X", baseURL: config.baseURL, secret: config.secret,
    database: drizzleAdapter(getDb(), { provider: "pg", schema: { user: users, session: sessions, account: accounts, verification: verifications, rateLimit: rateLimits } }),
    socialProviders: { google: { clientId: config.clientId, clientSecret: config.clientSecret } },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    rateLimit: { enabled: true, storage: "database", window: 60, max: 60 },
    account: { encryptOAuthTokens: true },
    onAPIError: { errorURL: "/login?error=1" },
    databaseHooks: {
      user: { create: { before: async (user) => {
        const allowed = process.env.ALLOWED_EMAILS?.split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
        if (allowed?.length && !allowed.includes(user.email.toLowerCase())) return false;
        return { data: user };
      } } },
    },
  });
}
let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() { return instance ??= createAuth(); }
export const getCurrentUser = cache(async () => {
  if (!isConfigured()) return null;
  const session = await getAuth().api.getSession({ headers: await headers() });
  return session?.user ?? null;
});
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
