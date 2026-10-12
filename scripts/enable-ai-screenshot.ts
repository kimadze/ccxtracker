/** Bind this private feature to an existing verified account, never an email at runtime. */
import nextEnv from "@next/env";
import { Client } from "pg";
import { mkdir, readFile, writeFile } from "node:fs/promises";
nextEnv.loadEnvConfig(process.cwd());
const email = process.argv[2]?.trim().toLowerCase();
if (!email || !process.env.DATABASE_URL)
  throw new Error("Provide an email and configure DATABASE_URL.");
const db = new Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});
try {
  await db.connect();
  const { rows } = await db.query(
    "SELECT id FROM users WHERE lower(email)=$1 AND email_verified=true",
    [email],
  );
  if (rows.length !== 1)
    throw new Error("Exactly one verified account is required.");
  const id = rows[0].id as string;
  const path = ".env.local";
  let env = await readFile(path, "utf8").catch(() => "");
  env = env.replace(/^AI_SCREENSHOT_USER_ID=.*\r?\n?/gm, "").trimEnd();
  await writeFile(path, `${env}\nAI_SCREENSHOT_USER_ID=${id}\n`);
  await mkdir(".local", { recursive: true });
  await writeFile(".local/screenshot-owner-id.txt", id);
  console.log(
    "Verified account bound locally. Use the ignored .local/screenshot-owner-id.txt value for AI_SCREENSHOT_USER_ID in production. No account data was printed.",
  );
} finally {
  await db.end();
}
