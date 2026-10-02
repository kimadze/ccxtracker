import "server-only";
import { del } from "@vercel/blob";
import { asc, eq, lte } from "drizzle-orm";
import { getDb, type Database } from "./db";
import { blobCleanupJobs } from "./db/schema";

export async function enqueueBlobCleanup(
  paths: string[],
  db: Database = getDb(),
) {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  if (!uniquePaths.length) return;
  await db
    .insert(blobCleanupJobs)
    .values(uniquePaths.map((blobPath) => ({ blobPath })))
    .onConflictDoNothing();
}

/** Process a bounded batch; failures remain durable and are retried with backoff. */
export async function processBlobCleanupJobs(
  db: Database = getDb(),
  limit = 25,
) {
  const jobs = await db.transaction(async (tx) => {
    const due = await tx
      .select()
      .from(blobCleanupJobs)
      .where(lte(blobCleanupJobs.nextAttemptAt, new Date()))
      .orderBy(asc(blobCleanupJobs.createdAt))
      .limit(limit)
      .for("update", { skipLocked: true });
    const claimUntil = new Date(Date.now() + 5 * 60_000);
    for (const job of due)
      await tx
        .update(blobCleanupJobs)
        .set({ nextAttemptAt: claimUntil })
        .where(eq(blobCleanupJobs.blobPath, job.blobPath));
    return due;
  });
  let deleted = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      await del(job.blobPath);
      await db
        .delete(blobCleanupJobs)
        .where(eq(blobCleanupJobs.blobPath, job.blobPath));
      deleted++;
    } catch {
      const attempts = job.attempts + 1;
      const delay = Math.min(24 * 60 * 60_000, 30_000 * 2 ** Math.min(attempts - 1, 10));
      await db
        .update(blobCleanupJobs)
        .set({
          attempts,
          nextAttemptAt: new Date(Date.now() + delay),
          lastError: "BLOB_DELETE_FAILED",
        })
        .where(eq(blobCleanupJobs.blobPath, job.blobPath));
      failed++;
    }
  }

  if (failed)
    console.error("Blob cleanup jobs remain queued", {
      failed,
      retryable: true,
    });
  return { processed: jobs.length, deleted, failed };
}
