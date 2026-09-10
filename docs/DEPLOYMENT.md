# Vercel deployment and operations

## Release status

The repository contains the application, SQL migrations, tests and Vercel cron configuration. No production database, Google OAuth project, CoinGecko account, private Blob store or Vercel deployment has been configured by this task. No paid services have been purchased. Perform the live checks below before inviting the intended approximately 50 users.

## Configure services

1. Create separate development/preview and production PostgreSQL databases, for example Neon branches. Keep application/database regions close. Copy the provider's TLS connection settings without disabling certificate verification. Set the pooled URL as `DATABASE_URL` and a direct URL as `DATABASE_MIGRATION_URL` for controlled migrations. The application pool has three connections per process; serverless instances can multiply this count.
2. Create a Google OAuth web application. Add `http://localhost:3000/api/auth/callback/google` for local development and `https://YOUR_DOMAIN/api/auth/callback/google` for production. Configure consent and test users as required by the Google project. Use separate credentials for untrusted previews. The callback path follows [Better Auth's Google provider documentation](https://better-auth.com/docs/authentication/google).
3. Generate two different secrets for `BETTER_AUTH_SECRET` and `CRON_SECRET`. The following prints one value locally; run it twice and store the results in environment settings, not in chat or source control:

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
   ```

4. Add a CoinGecko Demo key. Confirm the selected account's request quota and permitted use before launch. Quotes are shared across users, cached for five minutes and marked stale after fifteen minutes. Refresh work is bounded to 200 assets per call; search is limited to ten requests per minute per user. Provider errors retain available cached data. These controls reduce traffic but do not guarantee a plan's monthly allowance for every usage pattern.
5. Create a **private** Vercel Blob store and connect it to the project. Configure its token for local access or the linked store ID on Vercel. The application uses server uploads and authenticated streaming downloads through the [Blob SDK](https://vercel.com/docs/vercel-blob/using-blob-sdk). Verify real private-store access; a public store is not a substitute.
6. Optionally set `ALLOWED_EMAILS` to the initial invited Google accounts. This restricts new registrations only. Set `BETTER_AUTH_URL` to the exact final HTTPS origin; this also governs attachment origin checks.

## Deploy

1. Push the reviewed repository to your Git host and import it into Vercel using the Next.js framework preset. Use Node.js 24, project root `.`, install command `npm ci` and build command `npm run build`. Do not configure a static export directory.
2. Add the production variables from `.env.example` to the **Production** environment. Preview deployments must use separate data and credentials. Do not add server secrets with a `NEXT_PUBLIC_` prefix.
3. Before first production traffic, apply all migrations once using the production direct connection in a controlled shell or release job:

   ```sh
   npm run db:migrate
   ```

   Verify the target database first. The migration runner loads local environment files, so use an isolated release environment rather than an ambiguous developer shell. Drizzle records applied migrations. Do not run migrations concurrently in every Vercel build.
4. Deploy, set the final domain and update both the auth origin and Google callback if the domain changes. Redeploy after changing environment values. Run the live checks below before sharing the URL.

The migration `0002_wonderful_maximus.sql` intentionally creates the journal composite unique index before its referencing foreign key. Preserve that order. Fresh SQL application is tested in the database suite.

## Daily snapshots

`vercel.json` invokes `/api/cron/snapshots` with `0 20 * * *`: 20:00 UTC, approximately midnight Asia/Tbilisi. Vercel sends the configured `CRON_SECRET` as a bearer token. Missing/short secret returns 503; invalid credentials return 401.

The [current Vercel cron documentation](https://vercel.com/docs/cron-jobs/usage-and-pricing) allows daily Hobby scheduling with hourly timing precision; do not promise an exact midnight snapshot. Review current plan eligibility, function duration and usage before launch.

The handler has a 60-second function limit, a 45-second work budget, a 70-second lease and a 100-portfolio batch. It persists a cursor after each processed portfolio. A daily unique constraint prevents duplicates. Only complete, fresh valuations are inserted. JSON response fields include `busy`, `processed`, `skipped` and `complete`.

Inspect cron logs. If `complete` is false and `busy` is false, invoke the same authenticated endpoint again to resume the batch. A failed process's lease expires after 70 seconds. An operator or approved external scheduler must resume incomplete work; the app does not start background work after the response. If this is recurrent, adjust the schedule/worker strategy to the selected plan before growing the audience. Review skipped portfolios and provider failures instead of filling history with invented prices.

## Live acceptance checklist

- Sign in and out with a real Google account; a second browser receives its own private workspace. Test allowed and disallowed registration when using an allowlist.
- Create two portfolios, switch between them, record USD funding, a buy with fee, partial sale, a correction and an invalid oversell. Reload and verify cash, quantity, remaining basis and realized profit.
- Try the first user's portfolio, nested transaction, export and attachment URLs as a second user; each must be inaccessible.
- Verify a real quote, its provider timestamp, asset discovery and missing/stale-price behavior during a provider outage. Check settings' configuration state independently of actual quote freshness.
- Save/reload DCA-related transaction drafts, an exit plan, a journal, scenario/copy, goals, allocations and a watchlist item. Confirm planners do not create trades until explicitly saved as transactions.
- Upload a small valid PDF or image, download it as the owner, reject another user's request and delete it. Confirm a renamed executable or oversized body is rejected. Confirm private Blob access with your actual environment.
- Invoke the protected snapshot job, repeat it and confirm one row per portfolio/day. Check history again after a backdated correction.
- Export JSON, rename a portfolio, update profile name, revoke sessions and delete a disposable portfolio including its attachments.
- Check phone, tablet and desktop navigation, keyboard dialog focus and error messages on the deployed domain.

## Monitoring and capacity

Monitor Vercel function failures/duration, database connections/storage, quote failures, snapshot completion and Blob usage. Set provider billing alerts using the service dashboards. Never log environment strings, OAuth tokens, session cookies, full journal content or uploaded files. Application errors expose Georgian messages and generic server logs.

The local concurrency smoke test submits 50 competing edits to one portfolio revision and requires exactly one accepted write. It checks conflict prevention in PGlite; it does not measure production latency, 50 concurrent users or Neon transaction throughput. Run a bounded staging load test with representative portfolio/ledger sizes before making capacity guarantees. The current ledger replay scans the complete portfolio history on mutation; monitor latency as histories grow.

## Backup, restore and rollback

Enable your database provider's backups/point-in-time recovery for the retention period you require, and verify its plan-specific limits. Keep an encrypted periodic PostgreSQL logical backup using a direct connection and your approved secret manager. Back up the database schema, data and Drizzle migration journal together. Never commit dumps.

Keep a separate private copy of Blob objects with their original paths. Database attachment metadata alone cannot restore files. JSON user export is useful for inspection, but contains neither authentication records, all operational tables nor attachment bytes, and has no one-click import endpoint.

Before launch, restore a database backup to an isolated staging database and restore the corresponding Blob objects to private storage. Configure staging credentials, verify ledger totals and authenticated downloads, and document the measured recovery time and backup age. Do not run a restore against production as a test.

For an application regression, return to a known-good Vercel deployment only if it is compatible with the current schema. Use forward corrective migrations for normal repairs. Destructive schema rollback or point-in-time restoration requires a maintenance window and an explicit data-loss decision; preserve a new backup first. Revoke old sessions when rotating the authentication secret. Database and Blob deletion are separate systems: if a portfolio deletion reports failure, inspect both before retrying or repairing metadata.

## Known release boundaries

USD reporting, manual crypto transactions and Google sign-in are the implemented scope. Transfers are individually recorded; there is no paired transfer coordinator or consolidated multi-portfolio return calculation. Historical performance begins with captured snapshots and is an estimate, not exact intraday TWR. Fixed Asia/Tbilisi display is intentional; settings does not offer unsupported currency/timezone choices. No exchange synchronization, CSV import, tax reporting, background trade execution or account-administration console is represented as working functionality.
