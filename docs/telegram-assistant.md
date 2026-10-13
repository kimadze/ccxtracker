# Telegram portfolio lookup

No AI provider or AI charges. Uses the existing Telegram webhook and ledger.

- `/help` lists supported phrases.
- `/position XLM` or `რამდენი XLM მაქვს?` shows recorded holdings per selected portfolio.
- `/plan STRK` or `მაჩვენე STRK-ის გაყიდვის გეგმა` shows saved TP prices and percentages. These are plans, not exchange orders.

Only confirmed private chats are served. Shared/ambiguous chat mappings are refused. Ownership and selected portfolio IDs are checked; wallet portfolios are outside this ledger lookup. Up to ten portfolios and twenty levels per plan are displayed. Duplicate symbols require choosing the exact asset in the app.

Ten requests per minute per user; updates older than five minutes are ignored. Provider retries are suppressed before sending to avoid duplicate replies. If Telegram delivery fails after reservation, send the command again as a new message. No financial writes or external AI calls occur. Existing hosting/database usage still applies.

Connecting users can run `/help` after confirming the chat in CCX. No real Telegram test messages are sent by the automated tests.
