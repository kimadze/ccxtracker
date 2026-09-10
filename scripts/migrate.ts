import { loadEnvConfig } from "@next/env";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

loadEnvConfig(process.cwd());
const connectionString =
  process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;
if (!connectionString)
  throw new Error(
    "Set DATABASE_MIGRATION_URL or DATABASE_URL before applying migrations.",
  );
const pool = new Pool({ connectionString, max: 1 });
try {
  await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
  console.log("Migrations applied successfully.");
} finally {
  await pool.end();
}
