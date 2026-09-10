/** Isolated E2E harness. Not imported by the application and never used for deployment. */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { serializeSignedCookie } from "better-call";

const db = new PGlite();
for (const file of (await readdir("drizzle"))
  .filter((f) => f.endsWith(".sql"))
  .sort())
  await db.exec(await readFile(`drizzle/${file}`, "utf8"));
const secret = randomBytes(48).toString("base64url");
const users = ["alice-desktop", "alice-mobile", "bob"];
const cookies: Record<string, string> = {};
for (const name of users) {
  const token = randomBytes(32).toString("base64url");
  await db.query(
    "INSERT INTO users (id, name, email, email_verified) VALUES ($1, $2, $3, true)",
    [
      name,
      name.startsWith("alice") ? "სატესტო მომხმარებელი" : "მეორე მომხმარებელი",
      `${name}@example.test`,
    ],
  );
  await db.query(
    "INSERT INTO sessions (id, token, user_id, expires_at) VALUES ($1, $2, $3, $4)",
    [crypto.randomUUID(), token, name, new Date(Date.now() + 86400000)],
  );
  cookies[name] = (
    await serializeSignedCookie("better-auth.session_token", token, secret)
  )
    .split(";")[0]
    .slice("better-auth.session_token=".length);
}
await mkdir(".local", { recursive: true });
await writeFile(".local/e2e-cookies.json", JSON.stringify(cookies));
const socket = new PGLiteSocketServer({
  db,
  host: "127.0.0.1",
  port: 55439,
  maxConnections: 10,
});
await socket.start();
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--port",
    "3100",
    "--hostname",
    "127.0.0.1",
  ],
  {
    stdio: "inherit",
    windowsHide: true,
    env: {
      ...process.env,
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:55439/postgres",
      DATABASE_MIGRATION_URL: "",
      BETTER_AUTH_SECRET: secret,
      BETTER_AUTH_URL: "http://localhost:3100",
      GOOGLE_CLIENT_ID: "e2e-not-a-live-provider",
      GOOGLE_CLIENT_SECRET: randomBytes(32).toString("hex"),
      COINGECKO_DEMO_API_KEY: "",
      BLOB_READ_WRITE_TOKEN: "",
      BLOB_STORE_ID: "",
      ALLOWED_EMAILS: "",
      CRON_SECRET: randomBytes(32).toString("hex"),
    },
  },
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  child.kill();
  await socket.stop();
  await db.close();
}
process.on("SIGINT", () => {
  void stop();
});
process.on("SIGTERM", () => {
  void stop();
});
child.on("exit", () => {
  void stop();
});
