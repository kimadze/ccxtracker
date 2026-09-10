# Phase 6 — Professional polish and local release readiness

Local checkpoint passed on 2026-09-10. Production service verification remains pending.

## Implemented

- Added an independent watchlist with provider-backed asset search, desired entry prices, notes, editing and deletion. Watchlist rows never modify ledger holdings.
- Added profile and portfolio settings, source/freshness visibility, JSON export, database session revocation and confirmed portfolio deletion with attachment cleanup.
- Added advanced position and transaction search, filters, sorting, date range selection and pagination.
- Completed all preview navigation with clearly labeled fictional data. Preview workspaces cannot persist simulations or import fixtures into authenticated accounts.
- Completed responsive desktop sidebar, mobile dialog navigation, mobile allocation cards, accessible form labels, dialog focus management, visible focus states, skip navigation, reduced-motion handling and Georgian empty/error/loading states.
- Added explicit confirmed position-history deletion while retaining the investment journal and its private attachments. Retained journal assets remain accessible from the portfolio journal workspace.
- Added comma/space decimal normalization at the validated server boundary. DCA can now prepare a prefilled acquisition form, but the user must explicitly review and save it; sufficient recorded USD funding is still required.
- Added a bounded shared quote-refresh lease, provider error fallback, daily snapshot lease/cursor/idempotency behavior, database query timeouts and safe Georgian server-action errors.
- Added English developer setup, financial conventions and scope documentation in `README.md`, plus Vercel/Neon/OAuth/market/Blob configuration, cron operations, monitoring, live acceptance, backup/restore and rollback guidance in `docs/DEPLOYMENT.md`.

## Database and server boundaries

- Phase 6 schema is migration `0005_perpetual_multiple_man.sql`, adding independent watchlist entries and fixed USD/Asia-Tbilisi user settings.
- Existing migrations `0000` through `0005` apply successfully in order to a fresh PostgreSQL-compatible test database.
- Protected reads and mutations require a database session and portfolio ownership. Nested transaction, scenario, allocation, journal, watchlist, attachment and export access is portfolio scoped.
- Auth uses Better Auth's maintained Google provider, encrypted OAuth tokens, database sessions and database rate limiting. Asset search also uses a database fixed-window limit.
- Attachments are private, origin checked, ownership checked, limited to PDF/PNG/JPEG by MIME and signature, bounded to 2 MiB and five files per journal. Live Vercel Blob behavior still requires real credentials.
- Scheduled snapshots require a timing-safe bearer-secret match, use a lease and persistent cursor, process bounded batches and never store missing or stale valuations.

## Calculations and behavior verified

- Decimal ledger replay, weighted-average basis, buy/sell fees, partial/full sales, asset/USD fees, unknown basis, backdated correction, oversell and insufficient-cash rollback.
- Complete/missing/stale valuation states; flow-adjusted estimated performance; history coverage gaps; drawdown; allocation/concentration/reserve analysis.
- DCA, staged exits and recovery, scenarios and goals, target/custom capital allocation with exact cent conservation.
- Position deletion preserves journal data. Daily snapshot reruns remain unique and reject stale/missing quote coverage.
- A 50-competing-edit smoke test accepts exactly one write for one expected portfolio revision. This validates conflict handling in the isolated database and is not a production capacity benchmark.

## Final local verification

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: 8 files and 51 tests passed.
- `npm run build`: passed with Next.js 16.3.4; every intended route compiled.
- `npm run test:e2e`: 8 tests passed in desktop and mobile Chromium-compatible projects. The authenticated flow covered portfolio creation, funding, comma-decimal acquisition, DCA, persisted journal, saved/copied/deleted scenarios, allocation, watchlist, protected JSON export, position deletion with retained journal and cross-user denial. Public tests covered landing, anonymous redirect and every preview workspace at 390, 768 and 1440 pixel widths without horizontal overflow.
- `npm audit --omit=dev`: 0 known production dependency vulnerabilities.
- Visual screenshots were inspected for the overview at desktop and mobile sizes. They show the intended charcoal/purple Georgian financial interface and responsive card/table transformation.

## External configuration still required

- A production and separate preview/development PostgreSQL database and controlled migration run.
- Final application domain, `BETTER_AUTH_SECRET`, Google OAuth credentials and callback registration.
- CoinGecko Demo API key and confirmation that the selected plan/quota permits the intended usage.
- Private Vercel Blob store credentials and real upload/download/deletion checks.
- Independent `CRON_SECRET`, deployed daily invocation and inspection of snapshot completion/logs.
- A Vercel deployment followed by the complete live acceptance checklist in `docs/DEPLOYMENT.md`.

The local codebase is release-candidate complete for the documented manual crypto/USD scope. It must not be called production verified until the listed real services are configured and the live acceptance checklist passes.
