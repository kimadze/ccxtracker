# Telegram integration

One shared bot, separate private chat per CCX user. No phone number or Telegram password is collected. The user's selected asset symbols, target/current prices and authenticated CCX links are delivered to Telegram only after explicit linking and preferences.

## Production setup

1. Use the existing `@CCXTRACKER_BOT` from BotFather. Add `TELEGRAM_BOT_TOKEN` as a sensitive Vercel Production environment variable; never send it in chat or commit it.
2. Set `TELEGRAM_BOT_USERNAME=CCXTRACKER_BOT`, `TELEGRAM_WEBHOOK_SECRET` to a random 32+ character base64url secret and `BETTER_AUTH_URL=https://ccxtracker.vercel.app`. Redeploy after environment changes.
3. Register the webhook using operator-only `POST /api/telegram/setup` with `Authorization: Bearer <CRON_SECRET>` in a protected header. This uses the hosting environment's Telegram credentials without downloading them. Alternatively run `npm run telegram:setup` with the same protected variables locally. Setup verifies the bot username, refuses a webhook used by another application, registers the secret header and verifies the resulting URL. It never sends messages, deletes pending updates or returns credentials.
4. In Settings → Telegram, press the single bot-open/link button. It opens the bot in the same tab without a popup; press Start in Telegram, return to CCX and verify the displayed Telegram identity. Confirm it only if it is yours. Select portfolios and buy/sell alerts. Send a test notice. The pending link is retained in that tab's session storage for its ten-minute lifetime so returning/reloading does not mint repeated links; confirmation, cancellation and expiry clear it. Storage is optional, and the server still validates ownership and expiry.

Link codes are random, hashed in storage, single-use and expire after ten minutes. Private Telegram chat/from IDs must match. A second CCX-side confirmation prevents possession of a link alone from enrolling a recipient. One Telegram chat may belong to only one CCX user. Disconnect removes the link and queued deliveries. Reconnection rotates the delivery generation.

## Background checks

`GET` or `POST /api/cron/watchlist`, authenticated with `Authorization: Bearer <CRON_SECRET>`, refreshes up to 100 unique tracked assets, rotates its cursor for larger sets, evaluates valid new quotes and sends a bounded delivery batch. It shares the existing market cache/provider lease. Overlapping runs are leased. Configure an external HTTPS scheduler at five-minute intervals, or Vercel Pro cron. Vercel Hobby cron is limited to daily runs; the repository deliberately does not add an unsupported five-minute Vercel cron. Until a scheduler is configured, notices are generated during app opening/quote refresh and queued deliveries are processed on those requests; closed-app periodic detection is not active.

Never place CRON_SECRET in a URL. Use the scheduler's protected header field. Price-provider and hosting quotas still apply; no delivery-time guarantee is implied. When the tracked set exceeds 100 assets, a full scan takes multiple runs. The daily snapshot job also drains pending delivery retries, but is not a frequent price monitor.

## Delivery behavior

Only future buy-downward/sell-upward crossing episodes after enrollment are queued; linking does not send past notices. Queue creation and crossing state commit atomically. A unique episode key and row leases prevent normal duplicate/concurrent sending. Network/429 failures retry with bounded backoff; blocked bots pause buy/sell delivery. Removed targets/items, changed episodes, unselected portfolios and old connection generations cancel pending sends. Unsent alerts expire after six hours; records are cleaned after seven days. Telegram has no idempotency key for sendMessage: a process crash after Telegram accepts a message but before DB acknowledgement can produce a duplicate on retry. Financial ledger data is never modified.

Configuration absent: the Settings panel states that server setup is incomplete, and no outbound call occurs. No real Telegram deliveries are used in automated tests.

After a valid private Start message, the bot sends a generic **Return to CCX** button linking to the authenticated Telegram settings section. It does not send prices or confirm the connection. Telegram cannot force the browser to return automatically; the user taps this button and verifies the chat on CCX. If delivery fails, Telegram's webhook retry can send the instruction to the same valid pending chat. Another chat, expired code or already-confirmed code cannot obtain a return reply. The browser opened by Telegram must have the user's CCX session; otherwise normal sign-in is required.
