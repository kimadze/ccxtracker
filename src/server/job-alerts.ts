import "server-only";

/** Optional operations endpoint; payload contains no portfolio or user data. */
export async function sendJobAlert(code: string, count = 1) {
  const endpoint = process.env.CRON_ALERT_WEBHOOK_URL;
  if (!endpoint) return false;
  try {
    if (new URL(endpoint).protocol !== "https:") throw new Error("INVALID_URL");
    const body = JSON.stringify({ service: "ccx", code, count, occurredAt: new Date().toISOString() });
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(process.env.CRON_ALERT_WEBHOOK_TOKEN
              ? { Authorization: `Bearer ${process.env.CRON_ALERT_WEBHOOK_TOKEN}` }
              : {}),
          },
          body,
          signal: AbortSignal.timeout(2000),
          redirect: "error",
        });
        if (response.ok) return true;
        if (response.status < 500 && response.status !== 429) break;
      } catch {
        // A timeout/network failure is eligible for one bounded retry.
      }
    }
  } catch {
    // Keep configuration details and endpoint credentials out of logs.
  }
  console.error("CRON_ALERT_DELIVERY_FAILED", { code });
  return false;
}
