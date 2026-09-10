# Performance Attribution — Analytics extension

Completed and locally verified on 2026-09-10.

## Implementation

- Added a deterministic all-time attribution engine in `src/domain/attribution.ts`. It consumes the existing ledger result, portfolio summary and asset metadata; it does not persist separate balances, basis or P&L.
- Added `src/components/performance-attribution.tsx` inside the existing Analytics workspace under the Georgian name `პორტფელის შედეგის წყარო`.
- Asset rows expose realized P&L, unrealized P&L, total contribution, signed percentage contribution, current allocation, current-position return and contribution rank.
- Closed positions remain visible with realized-only results. Active positions require a current price. Unknown basis or missing price suppresses the complete module rather than showing unreconciled values.
- External deposits and withdrawals are excluded by the canonical ledger P&L. Separately recorded USD fees appear as an explicit fee contributor; this is required to reconcile the sum of contribution rows with portfolio-level total P&L.
- Negative portfolios retain signed contribution math. Loss contributors show their share of total loss; profitable offsets are labeled as loss reduction. Zero total P&L omits percentage contribution to avoid division by zero.
- Added category aggregation derived only from asset rows. Category cards show current allocation, total P&L, contribution percentage, member assets and largest positive/negative contributor.
- Added the `assets.category` metadata column with migration `0006_misty_scrambler.sql`. Existing core assets are classified during migration; newly discovered assets default honestly to `Other` until category metadata is available.
- Period controls continue to drive the existing flow-adjusted performance estimate. Attribution is explicitly labeled all-time because existing snapshots do not preserve daily per-asset holdings and market prices needed for accurate historical attribution.

## Verification

- Added eight attribution tests for profitable, mixed and total-loss portfolios; deposits/withdrawals; realized/unrealized and partially/fully closed positions; USD fees; categories; zero/empty cases; missing prices/unknown basis; contribution percentages and reconciliation.
- Explicit assertions verify asset totals against portfolio P&L and category totals against asset totals.
- `npm run check` passed: TypeScript, ESLint, 9 test files with 59 tests, and the Next.js production build.
- `npm run test:e2e` passed: 8 tests across desktop and mobile projects. Analytics attribution was asserted and captured at desktop/mobile sizes; preview workspaces remained free of horizontal overflow at 390, 768 and 1440 pixels.
- Migration `0006_misty_scrambler.sql` was applied successfully to the configured Neon database after the full local quality gate passed.

## External limitation

Live user values require CoinGecko credentials and complete quotes. Dynamically discovered assets without maintained category metadata are grouped as `Other`. Accurate period attribution remains future schema work and is not inferred from portfolio-level snapshots.
