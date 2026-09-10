# Phase 4 — Scenario engine

Local checkpoint passed on 2026-09-10.

- Added the shared scenario/goal calculation engine and scenario lab with immediate price changes, saved scenario create/update/delete/duplicate, current-price fallback labels, projected value/allocation/P&L and portfolio goal/milestone comparison.
- Quantities always come from current ledger-derived positions; stored scenarios contain price assumptions only. USD cash is included unchanged and unknown prices never become zero implicitly. Explicit zero target prices are supported as a total-loss scenario.
- Added migration `0003_closed_sleepwalker.sql` for scenarios, scenario prices and portfolio targets. Parent ownership is verified for CRUD and goal updates; asset references and duplicate asset inputs are validated.
- Added `/portfolios/[portfolioId]/scenarios` and save/delete scenario and save goal server actions.
- Typecheck passed; lint passed; 35 automated tests passed; production build passed.
- Expanded browser tests exposed test-account reuse across device projects and an exact-label selector issue for wrapped native selects. The harness now isolates device accounts and shared form labels use explicit ID associations. These browser fixes are pending the next full build/browser run; successful complete authenticated E2E is not yet claimed.
- External configuration requirements are unchanged. Next: target allocation and capital deployment.
