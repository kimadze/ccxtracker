# Telegram portfolio lookup

No AI provider or AI charges. Uses the existing Telegram webhook and ledger.

- `/help` lists supported phrases.
- `/position XLM` or `რამდენი XLM მაქვს?` shows recorded holdings per selected portfolio.
- `/plan STRK` or `მაჩვენე STRK-ის გაყიდვის გეგმა` shows saved TP prices and percentages. These are plans, not exchange orders.
- `/portfolio` shows value, total P/L and cash using cached prices; incomplete and stale valuations are marked.
- `/sales XLM` shows quantity sold, net USD proceeds and sale-only realized P/L across the full history, using `saleResults` from the ledger.
- `/alerts` shows only pending Watchlist and TP targets. Consumed directions disappear automatically; the other pending direction remains visible.
- `/history` shows reached Watchlist and TP targets with recorded price and time. Reached does not imply successful delivery. The saved plan itself (`/plan`) retains all its levels.
- `/next` ranks five pending enabled TP/Watchlist levels by percentage price distance. Missing/stale prices, consumed targets and mismatched TP position sizes are excluded. Distance is not a prediction.
- `/transactions` lists the five latest transactions across the selected portfolios, with links to the transaction pages.
- `/choose` lists the first ten authorized selected portfolios. `/portfolio 2` scopes the reply keyboard's subsequent reports to portfolio 2. `/sales XLM 2` and `/plan XLM 2` use the same explicit numbering; `/portfolio` returns to all selected portfolios. This does not change delivery preferences. Numbers are resolved against the current owned selection, so use `/choose` again after changing it in CCX.

Asset replies contain inline links for position, plan and transactions. Other report replies use a persistent Telegram reply keyboard for commands; no callback webhook registration is needed. Financial data is plain text (not interpolated HTML).

Only confirmed private chats are served. Shared/ambiguous chat mappings are refused. Ownership and selected portfolio IDs are checked; wallet portfolios are outside this ledger lookup. Up to ten portfolios and twenty levels per plan are displayed. Duplicate symbols require choosing the exact asset in the app.

Ten requests per minute per user; updates older than five minutes are ignored. Provider retries are suppressed before sending to avoid duplicate replies. If Telegram delivery fails after reservation, send the command again as a new message. No financial writes or external AI calls occur. Existing hosting/database usage still applies.

Connecting users can run `/help` after confirming the chat in CCX. No real Telegram test messages are sent by the automated tests.
