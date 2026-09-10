# Crypto Collective X — Implementation Plan

Status: implementation started on 2026-09-10. Phase 1 local checks passed; external-service verification is pending. See `docs/reports` for checkpoint evidence.

## Product and scope

Build the complete Georgian-language crypto portfolio intelligence application described in the supplied master instruction. Deliver in six verified phases, followed by deployment verification. All six phases belong to the intended release; phase one is a working foundation, not the final scope.

User-facing text, validation, accessibility labels, chart descriptions and authentication screens are Georgian. Code, developer documentation and phase reports are English. Asset names and established abbreviations can remain international.

Initial defaults: multiple users, multiple portfolios per user, USD valuation, manual transaction entry, Google sign-in through a maintained authentication library, and a CoinGecko-compatible market provider adapter. Verify provider suitability, credentials, licensing and current stable package compatibility before integration; record exact selected versions in the lockfile. Exchange synchronization, trade execution, subscriptions and tax reporting are outside the initial release.

## Confirmed operating scale and priorities

The user confirmed an intended audience of approximately 50 users, with no expected mass traffic. Correct functionality and real daily use take priority over high-scale infrastructure. This is an audience estimate, not a registration cap or a statement that all users will be concurrent.

Keep one modular Next.js application and one primary PostgreSQL database. Use the database-backed shared quote cache and bounded scheduled work already described below; do not introduce microservices, a separate Redis cluster, streaming infrastructure or a dedicated job platform without measured need. Price freshness should be explicit and provider-quota-aware; per-second streaming is not a requirement.

Retain the complete six-phase functional scope, decimal-safe calculations, atomic ledger writes, authentication, ownership isolation, backups and restore documentation. A small audience does not reduce correctness or privacy requirements. Prioritize end-to-end verification of funding, buys, partial sells, fees, corrections, portfolio switching and all linked planning tools. Include a bounded concurrency smoke test appropriate to the intended audience and check duplicate submissions and concurrent edits. Record the actual dataset and concurrency tested instead of asserting capacity from user count alone.

Keep recurring operating costs modest and review actual provider limits before choosing plans; no paid-plan purchase or assumption that every service will be free is implied. Release readiness means the core workflows work with configured real services and persisted user data, with honest stale/missing-data states.

## Architecture

- Next.js App Router, TypeScript, Tailwind CSS and selected shadcn/ui primitives.
- Neon PostgreSQL with Drizzle schema and committed migrations; Zod boundary validation.
- Server Components for authenticated reads; Server Actions or Route Handlers for validated mutations.
- A maintained authentication library with database sessions and OAuth; no custom password implementation. Final library selection follows compatibility verification in phase one.
- A pure typed decimal calculation package, independent of React and database access. PostgreSQL NUMERIC, decimal strings at serialization boundaries, and a decimal arithmetic library; JavaScript numbers only at presentation/chart boundaries when safe.
- Central Georgian message catalog and consistent Georgian number/date formatting. Persist timestamps in UTC and display in the user's timezone, initially Asia/Tbilisi.
- A server-only market provider service for discovery, bulk quotes and historical prices. Persist shared price cache with timestamps, provider attribution, rate limiting/backoff and last-known-price behavior. Missing prices are unavailable, never zero. Stale or incomplete valuations must be labeled and excluded from misleading performance conclusions.
- Portfolio-specific caches must include ownership context and be invalidated after writes. Shared market quotes contain no private portfolio data.

Suggested modules: `src/app`, `src/components`, `src/features`, `src/domain/calculations`, `src/domain/validation`, `src/server/auth`, `src/server/db`, `src/server/services`, `src/server/market`, `src/i18n`, `src/lib/formatters`, `tests`, `drizzle`, `docs/reports`.

## Financial contracts

1. Transactions are canonical from day one. Positions are derived projections, uniquely identified by portfolio and asset. Adding a position records an opening acquisition; editing holdings corrects source transactions with confirmation and recalculation. Never maintain a second independent quantity or average-price field.
2. Use moving weighted-average cost for the first release. Buy fees add to cost basis; sell fees reduce proceeds. A sale removes proportional basis and realizes net proceeds minus removed basis. Reject overselling, including overselling caused by backdated edits.
3. Model USD cash as a ledger balance and crypto stablecoins as separately priced assets. Funding deposits are external cash flows. Purchases and sales move cash and asset balances atomically. Offer an explicit funding step when required; never silently create money or assume a stablecoin is worth exactly USD 1.
4. Asset deposits need acquisition basis or an explicit unknown-basis state. Withdrawals transfer proportional basis out and do not constitute sales. Linked transfers between a user's portfolios carry basis and are excluded from consolidated external flows. Unknown basis makes affected P&L unavailable rather than invented.
5. Define fees with currency/asset and prevent double counting. The first supported trade-entry path uses USD fees. Asset-denominated standalone fees remove quantity and basis under a documented convention, tested separately. Unsupported fee combinations are rejected clearly.
6. Rebuild projections deterministically using transaction timestamp plus a stable tie-breaker. Transaction writes, cash legs and projection updates are atomic, ownership-scoped, concurrency-safe and protected against duplicate submissions. Keep an audit record for destructive corrections.
7. Distinguish gross contributions, net contributions, trade purchase spend and remaining cost basis. Unrealized P&L is current position value minus remaining basis; realized P&L reflects disposals. Portfolio economic P&L reconciles ending value, opening value and external flows, including standalone fees without double counting.
8. Position return uses remaining basis and is unavailable for zero/unknown basis. Portfolio period performance uses cash-flow-adjusted time-weighted returns where valuations permit. Do not present a deposit as investment gain. Label estimated or unavailable periods; drawdown derives from the flow-adjusted series.
9. Historical charts use stored snapshots and documented reconstruction only where historical prices and ledger coverage exist. Record coverage gaps. Do not fabricate pre-onboarding history. Corrections invalidate affected derived history.
10. DCA, scenarios, exits and deployment are simulations using the same current positions. Only an explicit confirmed action may convert a simulation into a transaction.
11. Exit percentages reference starting position quantity and cannot exceed 100% in total. Show fee assumptions, remaining quantity and weighted exit price. Capital recovery compares cumulative net proceeds with the plan's explicitly displayed recovery basis, defaulting to current position cost basis; show when recovery is never reached.
12. Target weights must total 100%, including reserve. Target-based capital deployment is a buy-only constrained allocation: distribute the entered budget to reduce post-contribution target deviations, with deterministic rounding and no negative allocations. Test that allocations sum to the available budget. Custom mode also validates its total.
13. Health indicators explain concentration, top-three share, diversification and reserve composition. Any composite score has published thresholds and weights, coverage requirements and tests. It describes portfolio structure, not a prediction or investment recommendation.

## Database design

Core entities: users, portfolios, assets, positions, transactions, portfolio_snapshots, portfolio_targets, target_allocations, portfolio_scenarios, scenario_asset_prices, exit_plans, exit_plan_levels, position_journals, watchlist_items and user_settings.

Supporting entities as needed: auth accounts/sessions, ledger legs or transfer links, market quote cache, snapshot job state, audit records and journal attachments. Attachments use private object storage with validated size/type and ownership-protected access; do not store files on a Vercel function filesystem.

Use foreign keys, ownership relationships, timestamps, numeric bounds and check constraints. Add unique portfolio/asset position and allocation constraints, provider/asset identity constraints, and indexes for user portfolios, portfolio transaction time, portfolio snapshots and asset quotes. Scope nested references to the same portfolio through composite constraints where practical and transactional server validation everywhere. Commit migrations incrementally by phase.

## UX and routes

The user explicitly confirmed a modern Tailwind CSS visual direction. Use Tailwind as the primary styling system, with shared design tokens for surfaces, typography, spacing, borders and interaction states. Selected shadcn/ui primitives should be styled to the product identity. Establish the visual system in phase one rather than defer it to final polish: charcoal layered surfaces, restrained purple accents, generous spacing, prominent financial values, readable Georgian text and subtle purposeful transitions that respect reduced-motion preferences. Validate the overview, positions list and transaction dialog on desktop and mobile as the first representative screens.

Charcoal surfaces, restrained purple accents, legible Georgian typography, strong financial hierarchy and minimal decorative effects. Green/red express financial states and are supplemented by signs and text. Desktop sidebar; dedicated mobile navigation and position layouts. Keyboard access, contrast, focus management and Georgian loading/error/empty/confirmation states are requirements throughout development.

Public routes: landing and login. Protected workspace: portfolio selection/creation, then `/portfolios/[portfolioId]` with positions, transactions, analytics, scenarios, allocation, strategy and journal sections; position detail has overview, transactions, DCA, exit and journal views. Settings and watchlist are also protected. URLs are internal implementation names; visible navigation is Georgian.

## Delivery phases and acceptance

### Phase 1 — Foundation

Set up tooling, CI, application shell, Georgian typography/messages, responsive navigation, database/migrations, authentication, multi-portfolio management, asset discovery, transaction ledger, position projections, calculation engine, overview and position overview. Establish loading, errors and ownership protection immediately.

Acceptance: a user can sign in, create and switch portfolios, record funding/buys/partial sells, and see reconciled balances and P&L. Another user cannot read or mutate any nested resource. Correcting a backdated transaction recalculates dependent positions safely. Empty accounts contain no fake holdings.

### Phase 2 — Portfolio intelligence

Implement authenticated scheduled snapshots, quote cache refresh, portfolio value and performance histories, period selection, asset contribution, realized/unrealized breakdown, flow-aware drawdown, concentration and explainable health analysis. Jobs are bounded, idempotent and resumable.

Acceptance: deposits do not appear as returns; historical gaps and stale quotes remain visible; repeated snapshot jobs do not duplicate records. Health explanations can be traced to actual metrics.

### Phase 3 — Position intelligence

Complete position detail, searchable transaction history, live DCA planning, saved staged exits, fee assumptions, capital recovery, and position journal with private attachments.

Acceptance: DCA and exits reconcile with ledger-derived positions; simulations cannot mutate holdings without confirmation; exit quantities never exceed holdings; attachments cannot be accessed by another user.

### Phase 4 — Scenario engine

Implement Quick What-If, scenario create/edit/duplicate/delete, projected value and allocation, per-asset contribution, portfolio goals, milestones and scenario/goal comparison. Persist target prices, derive quantities from current holdings, and show calculation freshness.

Acceptance: changes in holdings are reflected consistently across saved scenario calculations; missing target prices use an explicitly labeled current-price assumption or require input. No re-entry of quantities.

### Phase 5 — Allocation engine

Implement target allocation editing, over/underweight analysis, target-based capital deployment and custom allocation. Show reserve handling, assumptions and remaining deviations.

Acceptance: valid target weights total 100%; allocations never overspend or become negative; impossible exact rebalancing using buys alone is explained; no trades are executed by planning actions.

### Phase 6 — Professional polish

Complete watchlist, advanced filtering/pagination, profile and portfolio settings, source/freshness visibility, responsive refinement, accessibility review, micro-interactions, metadata, performance tuning, operational documentation and complete cross-feature end-to-end verification.

Acceptance: every specified workspace is functional, Georgian and tested at mobile/tablet/desktop sizes. Watchlist holdings remain separate from actual positions. No dead controls, misleading charts or placeholder functionality are presented as complete.

## Quality gates

At the start of every phase inspect existing code and fit changes into the domain model. At its end run TypeScript typecheck, lint, automated tests and production build; fix failures before declaring completion. Store English phase reports with modules, schema/migrations, routes/actions, calculations, tests, security review, command outcomes, external configuration and next phase.

Calculation fixtures cover profit/loss, partial/full sales, fees, basis, backdating, transfers, empty portfolios, zero denominators, precision, invalid inputs, allocation, DCA, scenarios, goals, exits/recovery and deployment conservation. Integration tests use a separate test database and cover authentication, cross-user/cross-portfolio access, invalid nested references, concurrency and rollback. Browser tests cover onboarding, transactions, planning and key responsive workflows.

Security includes server-only secrets, secure sessions, request-origin/CSRF protection appropriate to the selected auth stack, validation at every mutation boundary, authorization on reads and writes, rate limits on sensitive endpoints and safe Georgian errors with redacted server logs. No real secrets or user data in tests or documentation.

## Vercel release and external configuration

Use a server-backed Next.js deployment, not static export. Connect Neon through a serverless-compatible driver/pooled connection as appropriate. Separate production and preview/test databases. Apply reviewed migrations through a controlled release step rather than concurrently in every build. Configure production URL and OAuth callbacks per environment.

Required configuration will include Neon connection strings, auth secret and OAuth credentials, market provider credentials where required, scheduled-job secret, and private object-storage credentials for attachments. Record exact variable names in `.env.example` after provider selection. The user enters secrets in local environment files or Vercel settings; do not request pasted secrets in chat.

Verify current Vercel plan limits, provider quotas, snapshot cadence and storage requirements during implementation. Default snapshot target is daily; final scheduling must match the selected plan and scale. Use persisted batches/checkpoints rather than an unbounded portfolio loop or permanent background process.

Prepare README setup, environment validation, database migrations, test commands, deployment guide, health checks, safe observability, backup/restore procedure and rollback instructions. Run deployment smoke tests against configured services: sign-in/out, isolation, CRUD, quotes, scheduled snapshots and core calculations. Live deployment is verified only after credentials and a deployed environment exist; distinguish local completion from production verification.

Official deployment references consulted during planning:

- https://nextjs.org/docs/app/getting-started/deploying
- https://vercel.com/docs/frameworks/full-stack/nextjs
- https://neon.com/docs/guides/vercel-manual
- https://neon.com/docs/connect/connection-pooling

## Decisions to confirm during plan review

- Initial crypto-only scope follows the supplied specification; securities would require separate market and instrument models.
- Proposed initial entry method is manual transactions; exchange and wallet synchronization can be scoped separately.
- Proposed initial authentication is Google sign-in; email sign-in can replace or supplement it if required.
- User supplies service accounts and the acceptable recurring service budget before paid integrations or plan-dependent deployment decisions.
