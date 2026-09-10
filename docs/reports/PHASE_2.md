# Phase 2 — Portfolio intelligence

Local checkpoint passed on 2026-09-10.

- Added a shared analytics engine, daily value history and accessible chart/table, period filters, asset performance comparisons, concentration/top-three/reserve metrics and an explainable effective position count.
- Returns and drawdown are explicitly labeled Modified Dietz estimates. They adjust USD funding flows and suppress results for asset transfers without market valuations, missing coverage, zero capital and gaps greater than 48 hours. Exact intraday TWR is not claimed.
- Added portfolio snapshots and resumable leased snapshot-job state through `0001_majestic_pixie.sql`. Ledger corrections invalidate affected snapshots atomically.
- Added `/portfolios/[portfolioId]/analytics` and secret-protected `/api/cron/snapshots`, with daily Vercel scheduling. Jobs have a portfolio bound and elapsed-time budget, persist progress and reject overlap. Operator continuation is required when a run reports incomplete; cadence/capacity needs verification on the selected Vercel plan.
- Quote freshness governs snapshot eligibility; no historical data is fabricated. The isolated demo chart is clearly labeled as illustrative.
- Typecheck passed; lint passed; 24 automated tests passed; production build passed. Dependency audit after a tested esbuild override reported zero vulnerabilities.
- Live scheduler, Neon latency/concurrency, provider freshness and Google sign-in still require configured external services. Browser validation is being run separately.
- Next phase: DCA, staged exits, capital recovery and journal.
