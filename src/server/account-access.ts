import "server-only";
import { eq } from "drizzle-orm";
import type { Database } from "./db";
import { users, suspendedUsers } from "./db/schema";

export async function accountIsActive(db: Database, userId: string) {
  const [account] = await db
    .select({ id: users.id, suspended: suspendedUsers.userId })
    .from(users)
    .leftJoin(suspendedUsers, eq(users.id, suspendedUsers.userId))
    .where(eq(users.id, userId));
  return Boolean(account && !account.suspended);
}
