# Position Take Profit alerts

Position → Plan → Take Profit reuses the existing exit plan. Set target prices and percentages, enable Telegram alerts and save. Telegram must already be linked in Settings. This plan-specific opt-in is independent of Watchlist buy/sell preferences. No exchange order or financial transaction is created.

Each level sends once after a fresh quote below its target followed by a newer quote at or above it. An initial quote already above the target does not send; the UI warns that a future crossing is required. Stale, missing, nonpositive and out-of-order quotes cannot trigger. Several levels crossed in one quote are combined in one message. Explicit rearm resets only the selected level; unchanged saves preserve reached levels. Changed targets or toggled alerts start a new baseline.

Percentages use the position quantity recorded when the plan is saved. Any quantity change pauses detection and queued delivery until the plan is reviewed and saved. Unknown cost basis allows alerts but hides calculated profit and capital recovery. Delivery includes symbol, observed price, target levels, planned quantities and estimated gross proceeds, with a position link. It never executes a sale.

Crossing state and delivery creation commit atomically. Delivery jobs have bounded retries, leases, connection/plan generation checks and a six-hour lifetime. Disconnect, plan edits, disabling alerts and rearm cancel obsolete deliveries. Telegram does not provide sendMessage idempotency, so a crash after acceptance but before acknowledgement may duplicate a retry.

## Closed-app checks

Reached state belongs to a target price: editing another level, changing percentages, toggling alerts or reviewing a changed position quantity does not re-notify an already reached price. Only explicit rearm or a new target price starts a new episode. Fresh cached quotes can establish an enrollment baseline, avoiding the loss of a first crossing before the next poll. Queued unchanged levels retain their episode when another level is edited; current level numbering is used when delivered.

Terminal delivery failures are retained and can be retried from Telegram Settings within the six-hour lifetime. Blocked connections pause both Watchlist and Take Profit delivery until a successful connection test. Take Profit opt-in remains independent of Watchlist preferences. Messages label the observed price and CoinGecko USD source; these are price alerts, not executable exchange orders.

`.github/workflows/price-alerts.yml` calls the protected `/api/cron/watchlist` endpoint approximately every five minutes, using the repository secret `CCX_CRON_SECRET` matching production `CRON_SECRET`. The secret is passed only in an Authorization header. Both Watchlist and Take Profit assets share the rotating scan, quote cache and provider lease. A run processes at most 100 unique assets; larger sets need several runs. The daily snapshot job also drains retries.

GitHub scheduling can be delayed or skipped; this is not a real-time trading execution service. Public repositories may have scheduled workflows disabled after 60 days without repository activity. GitHub Actions, hosting and price-provider quotas apply. Workflow output contains only aggregate counts. Use workflow_dispatch for an operator smoke check after deployment.

## Validation

Isolated database tests cover crossing, initial-above enrollment, stale quotes, grouped delivery, unknown basis, ownership, unchanged save, rearm, quantity changes and retry/disconnect behavior. Browser fixtures use a fake Telegram configuration and isolated ledger, test saving/rearm and inspect 360–1440px layouts without sending real messages.
