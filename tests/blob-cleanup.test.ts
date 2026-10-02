import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import type { Database } from "@/server/db";
import { blobCleanupJobs } from "@/server/db/schema";
import { enqueueBlobCleanup, processBlobCleanupJobs } from "@/server/blob-cleanup";

const { deleteBlob } = vi.hoisted(() => ({ deleteBlob: vi.fn() }));
vi.mock("@vercel/blob", () => ({ del: deleteBlob }));
const client = new PGlite();
const testDb = drizzle(client);
const db = testDb as unknown as Database;
beforeAll(async () => {
  await client.exec(await readFile("drizzle/0011_durable_blob_cleanup.sql", "utf8"));
});
afterAll(() => client.close());
afterEach(async () => {
  await testDb.delete(blobCleanupJobs);
  vi.restoreAllMocks();
  deleteBlob.mockReset();
});

it("retains failed deletions, waits for backoff, then removes a successful retry", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  await enqueueBlobCleanup(["test-file", "test-file", ""], db);
  deleteBlob.mockRejectedValueOnce(new Error("provider unavailable"));
  expect(await processBlobCleanupJobs(db)).toEqual({ processed: 1, deleted: 0, failed: 1 });
  const [queued] = await testDb.select().from(blobCleanupJobs);
  expect(queued.attempts).toBe(1);
  expect(queued.lastError).toBe("BLOB_DELETE_FAILED");
  expect(queued.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  expect(await processBlobCleanupJobs(db)).toEqual({ processed: 0, deleted: 0, failed: 0 });
  expect(deleteBlob).toHaveBeenCalledTimes(1);
  await testDb.update(blobCleanupJobs).set({ nextAttemptAt: new Date(0) });
  deleteBlob.mockResolvedValueOnce(undefined);
  expect(await processBlobCleanupJobs(db)).toEqual({ processed: 1, deleted: 1, failed: 0 });
  expect(await testDb.select().from(blobCleanupJobs)).toEqual([]);
});

it("claims work before deletion so another worker does not process it twice", async () => {
  await enqueueBlobCleanup(["claimed-file"], db);
  deleteBlob.mockImplementationOnce(async () => {
    const [claimed] = await testDb.select().from(blobCleanupJobs).where(eq(blobCleanupJobs.blobPath, "claimed-file"));
    expect(claimed.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + 240_000);
    expect(await processBlobCleanupJobs(db)).toEqual({ processed: 0, deleted: 0, failed: 0 });
  });
  expect(await processBlobCleanupJobs(db)).toEqual({ processed: 1, deleted: 1, failed: 0 });
});
