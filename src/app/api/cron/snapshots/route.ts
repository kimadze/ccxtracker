import { timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { runSnapshots } from "@/server/snapshots";
import { processBlobCleanupJobs } from "@/server/blob-cleanup";
import { sendJobAlert } from "@/server/job-alerts";
import { processTelegramDeliveries } from "@/server/telegram/delivery";
import { processTakeProfitDeliveries } from "@/server/telegram/take-profit";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || expected.length < 32)
    return Response.json({ error: "სერვისი მიუწვდომელია." }, { status: 503 });
  const actual = request.headers.get("authorization") ?? "";
  const token = `Bearer ${expected}`;
  if (
    Buffer.byteLength(actual) !== Buffer.byteLength(token) ||
    !timingSafeEqual(Buffer.from(actual), Buffer.from(token))
  )
    return Response.json({ error: "წვდომა აკრძალულია." }, { status: 401 });
  try {
    const startedAt = Date.now();
    const initial = await runSnapshots({ timeBudgetMs: 25000 });
    after(async () => {
      let latest = initial;
      let skipped = initial.skipped;
      const alerts: string[] = [];
      let affected = 0;
      try {
        while (
          !latest.complete &&
          !latest.busy &&
          Date.now() - startedAt < 54000
        ) {
          const remaining = 54000 - (Date.now() - startedAt);
          const next = await runSnapshots({
            timeBudgetMs: Math.max(1000, Math.min(25000, remaining - 5000)),
          });
          skipped += next.skipped;
          if (next.busy || (!next.complete && next.processed === 0)) {
            latest = next;
            break;
          }
          latest = next;
        }
        if (skipped) {
          console.error("SNAPSHOT_JOB_SKIPPED_PORTFOLIOS", {
            skipped,
            cursor: latest.cursor,
          });
          alerts.push("SNAPSHOT_JOB_SKIPPED_PORTFOLIOS");
          affected += skipped;
        }
        if (!latest.complete && !latest.busy) {
          console.error("SNAPSHOT_JOB_NEEDS_RESUME", {
            processed: latest.processed,
            cursor: latest.cursor,
          });
          alerts.push("SNAPSHOT_JOB_NEEDS_RESUME");
        }
      } catch (error) {
        console.error("SNAPSHOT_JOB_CONTINUATION_FAILED", {
          cursor: latest.cursor,
          reason: error instanceof Error ? error.message : "UNKNOWN",
        });
        alerts.push("SNAPSHOT_JOB_CONTINUATION_FAILED");
      }
      try {
        const cleanup = await processBlobCleanupJobs(undefined, 10);
        if (cleanup.failed) {
          alerts.push("BLOB_CLEANUP_FAILED");
          affected += cleanup.failed;
        }
      } catch (error) {
        console.error("BLOB_CLEANUP_BATCH_FAILED", {
          reason: error instanceof Error ? error.message : "UNKNOWN",
        });
        alerts.push("BLOB_CLEANUP_BATCH_FAILED");
      }
      // One bounded delivery avoids multiplying webhook timeouts per cron run.
      if (Date.now() - startedAt < 48000) {
        try {
          await processTelegramDeliveries(undefined, 1);
          if (Date.now() - startedAt < 48000)
            await processTakeProfitDeliveries(undefined, 1);
        } catch {
          console.warn("TELEGRAM_QUEUE_RETRY_PENDING");
        }
      }
      if (alerts.length)
        await sendJobAlert(alerts.join(","), Math.max(1, affected));
    });
    return Response.json({
      ...initial,
      continuationScheduled: !initial.busy && !initial.complete,
    });
  } catch {
    console.error("Snapshot job failed");
    after(() => sendJobAlert("SNAPSHOT_JOB_FAILED"));
    return Response.json(
      { error: "მონაცემების შენახვა ვერ მოხერხდა." },
      { status: 500 },
    );
  }
}
