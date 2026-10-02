import { afterEach, expect, it, vi } from "vitest";
import { sendJobAlert } from "@/server/job-alerts";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("does not send when no alert destination is configured", async () => {
  vi.stubEnv("CRON_ALERT_WEBHOOK_URL", "");
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  expect(await sendJobAlert("SNAPSHOT_JOB_FAILED")).toBe(false);
  expect(fetcher).not.toHaveBeenCalled();
});

it("retries a transient failure once and sends only operational data", async () => {
  vi.stubEnv("CRON_ALERT_WEBHOOK_URL", "https://alerts.example.test/jobs");
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 503 })).mockResolvedValueOnce(new Response());
  vi.stubGlobal("fetch", fetcher);
  expect(await sendJobAlert("BLOB_CLEANUP_FAILED", 3)).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ service: "ccx", code: "BLOB_CLEANUP_FAILED", count: 3, occurredAt: expect.any(String) });
});

it("does not retry rejected credentials", async () => {
  vi.stubEnv("CRON_ALERT_WEBHOOK_URL", "https://alerts.example.test/jobs");
  vi.spyOn(console, "error").mockImplementation(() => {});
  const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
  vi.stubGlobal("fetch", fetcher);
  expect(await sendJobAlert("SNAPSHOT_JOB_FAILED")).toBe(false);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
