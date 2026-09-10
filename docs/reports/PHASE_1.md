# Phase 1 — Foundation

Implemented on 2026-09-10. Local foundation validation passed. Live Neon, Google OAuth and market data integration remain unverified until external credentials are configured.

- Modules: Next.js App Router shell, Georgian Tailwind design system and locally bundled fonts; public landing/login and isolated illustrative preview; authenticated portfolio and transaction workflows; typed decimal ledger and valuation; server-only data access, authentication and market provider adapter.
- Database: users, sessions, accounts, verifications, rate limits, portfolios, assets, transactions, derived positions, quote cache and audit records. Generated migration: `drizzle/0000_quick_psynapse.sql`.
- Routes: `/`, `/login`, `/preview`, `/portfolios`, portfolio overview, positions, position details, transactions and `/api/auth/[...all]`.
- Server operations: create/list/rename/delete portfolios; create/correct/delete ledger entries; asset discovery. Portfolio row locks, revision checks, duplicate submission handling and atomic projection rebuilds protect ledger mutations.
- Calculations: moving weighted-average cost, partial/full sales, acquisition/disposal fees, cash balances, asset transfers, unknown basis, realized/unrealized P&L, valuation, allocation and position return.
- Tests: 19 passing tests, including actual PostgreSQL semantics through isolated in-memory PGlite using generated SQL migrations. Coverage includes ownership and nested-resource isolation, transaction rollback, revision checks and corrections. This does not substitute for hosted Neon concurrency testing or real OAuth callbacks.
- Security: identity from server sessions; server ownership predicates on reads and mutations; Zod input validation; secrets confined to server modules; secure authentication library and Georgian error boundary. No production authentication bypass or fake user holdings.
- Typecheck: passed. Lint: passed with no warnings. Automated tests: 19 passed. Production build: passed with all currently implemented routes compiled. Windows tool spawning required execution outside the restricted sandbox.
- Pending functionality follows phases 2–6. Navigation anticipates these routes; they are not claimed complete at this checkpoint. Linked inter-portfolio transfer UI is not implemented yet; independent asset deposits/withdrawals are supported with documented basis treatment. Actual price history is intentionally empty until observations exist.
- External configuration: database URL/migrations; strong Better Auth secret and base URL; Google OAuth credentials/callback; CoinGecko demo API key. No real credentials have been requested in chat or stored in source.
- Next: portfolio history, snapshots, cash-flow-aware performance and explainable health indicators.
