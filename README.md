# Crypto Collective X

Georgian-language crypto portfolio tracking and planning for a small private audience. Built with Next.js, TypeScript, Tailwind CSS, PostgreSQL/Drizzle, Better Auth and decimal arithmetic. The application is intended for a Vercel deployment with a separate PostgreSQL database and private object storage.

## Features

- Google sign-in, private database sessions, multiple portfolios and ownership checks on all protected resources.
- Funded transaction ledger: deposits, buys, partial/full sales, withdrawals, fees, corrections and confirmed deletion. Holdings and cash are recalculated atomically.
- Overview, searchable positions, filtered/paginated transactions, explicit missing/stale prices and daily history.
- Cash-flow-adjusted estimated performance, drawdown, concentration, reserve analysis and reconciled all-time performance attribution by asset and category.
- DCA with a prefilled transaction draft, saved staged exits, capital recovery, journals and private attachments.
- Saved what-if scenarios, copies, portfolio goals, milestones, target allocations and capital deployment simulations.
- Independent watchlist, profile/portfolio settings, JSON export and session revocation.
- Georgian typography, decimal/date formatting, responsive navigation and accessible dialogs.

## Local setup

Use Node.js 24 (tested with 24.16.0) and npm. Exact dependencies are committed in `package-lock.json`.

```sh
npm ci
```

Copy `.env.example` to `.env.local` and configure the variables described below. Never commit credentials. Apply migrations to your development database, then start the app:

```sh
npm run db:migrate
npm run dev
```

Open `http://localhost:3000`. `/preview` contains explicitly fictional fixtures and works without service credentials; an authenticated portfolio starts empty. Preview pages never write data. Real sign-in requires configured services.

## Environment

| Variable                                   | Purpose                                                                            |
| ------------------------------------------ | ---------------------------------------------------------------------------------- |
| `DATABASE_URL`                             | PostgreSQL application connection, preferably the provider's pooled TLS connection |
| `DATABASE_MIGRATION_URL`                   | Direct development/release database connection; falls back to `DATABASE_URL`       |
| `BETTER_AUTH_SECRET`                       | Independently generated random secret, at least 32 characters                      |
| `BETTER_AUTH_URL`                          | Exact application origin, HTTPS in deployment                                      |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth web application credentials                                           |
| `COINGECKO_DEMO_API_KEY`                   | Server-only CoinGecko Demo API key for discovery/quotes                            |
| `CRON_SECRET`                              | Independent random secret, at least 32 characters                                  |
| `BLOB_READ_WRITE_TOKEN`                    | Private Vercel Blob store credential, including local development                  |
| `BLOB_STORE_ID`                            | Alternative linked-store configuration on Vercel                                   |
| `ALLOWED_EMAILS`                           | Optional comma-separated allowlist for new Google registrations                    |

Changing the allowlist does not revoke existing accounts or sessions. Settings offers session revocation. Account administration is outside the current user interface.

## Verification

```sh
npm run check
npm run test:e2e
```

`check` runs TypeScript, ESLint, Vitest and the production build. Database tests apply every SQL migration to an isolated PGlite database. Browser tests start the production build against a separate temporary PostgreSQL protocol harness and exercise real signed database sessions. The harness is never imported by the application. Windows browser tests use installed Microsoft Edge; Linux CI installs Chromium. For Linux development, run `npx playwright install --with-deps chromium` once.

The 50-competing-edit test verifies revision conflict handling in the isolated database. It is not a benchmark of 50 live browsers or proof of Neon/Vercel capacity. OAuth provider exchange, live market requests, Blob storage and deployed cron require the release smoke tests in [the deployment guide](docs/DEPLOYMENT.md).

## Financial conventions

Transactions are the source of truth. Moving weighted-average cost includes buy fees; sell fees reduce proceeds. Overselling and insufficient cash are rejected, including when a historical correction breaks later transactions. USD funding must be entered explicitly. Stablecoins receive market quotes and are never assumed to be worth one dollar.

Asset deposits accept the original unit acquisition basis or an explicit unknown basis. Unknown basis suppresses affected profit and contribution totals. Withdrawals remove proportional basis and do not realize sale proceeds. Contribution/withdrawal totals involving crypto represent basis transferred, not historical fair market value. Standalone asset fees expense their removed basis; any additional USD fee is separately expensed. No tax-lot or tax-reporting claim is made.

Daily performance uses chained Modified Dietz estimates for sufficiently covered intervals. Asset transfers without reliable flow valuation and history gaps suppress affected returns. No pre-onboarding history is fabricated, and backdated corrections invalidate affected snapshots. Snapshot day keys use UTC; display dates use Asia/Tbilisi.

Performance attribution uses the canonical ledger and current market valuation. Each asset's total contribution is realized plus unrealized P&L; separately recorded USD fees appear as an explicit fee contributor so the rows reconcile exactly with portfolio P&L. Closed positions remain in all-time attribution. Unknown basis or missing current prices suppress unreconciled output. Category totals are derived from asset metadata, with unclassified provider-discovered assets shown as `Other`. Period attribution is intentionally unavailable until historical per-asset holdings and prices are stored with sufficient coverage.

Simulations read the same current holdings. DCA assumes additional external capital; a saved real purchase requires sufficient recorded USD cash. Exit percentages use original current quantity and cannot exceed 100%. Target allocation weights must total 100%; deployment uses buy-only proportional deficits with deterministic cent rounding. It cannot promise exact rebalancing of overweight positions through purchases alone.

The current release records transfers manually as withdrawals/deposits. Automatically linked transfers and consolidated cross-portfolio external-flow accounting are not implemented. Exchange/wallet synchronization, securities, automatic trading, import, multi-currency valuation and tax reporting are outside this release.

## Architecture and operation

- `src/domain`: pure ledger, valuation, analytics and planning functions; numeric strings cross boundaries.
- `src/server`: authenticated services, rate limits, shared market cache, scheduled history and database access.
- `src/app`: server-rendered workspaces, protected actions and API routes.
- `src/components`: responsive Georgian presentation and interactive planners.
- `drizzle`: schema migrations and metadata; migrations are a controlled release step, never automatic build side effects.
- `tests`: calculation, PostgreSQL service and browser coverage.
- `docs/reports`: phase checkpoints and actual verification evidence.

Private attachments accept PDF/PNG/JPEG, up to 2 MiB and five files per journal. Content signatures, ownership and request origin are checked. Downloads are authenticated attachments. This is not antivirus scanning. Journals and their attachments remain accessible after position deletion. Deleting an entire portfolio removes its related data and attempts Blob cleanup first.

JSON export includes transactions and planning data; it is not a restorable full database backup and does not contain attachment bytes. Follow the database and Blob backup/restore procedure in [DEPLOYMENT.md](docs/DEPLOYMENT.md).

Local implementation and tests do not constitute a live production launch. See the deployment guide for required service configuration and the remaining live acceptance checklist.
