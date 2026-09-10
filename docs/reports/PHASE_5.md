# Phase 5 — Allocation engine

Local checkpoint passed on 2026-09-10.

- Added target allocation persistence and deviation analysis including cash reserves and assets not currently held.
- Added target-based and custom capital deployment. Target mode allocates new cash proportionally to positive deficits against post-funding targets; it never sells overweight positions. Largest-remainder cent rounding conserves the budget exactly. Custom amounts must sum to the budget.
- Added migration `0004_real_purifiers.sql`, `/portfolios/[portfolioId]/allocation`, allocation service and save action with ownership, asset and weight validation.
- Missing current portfolio quotes suppress deployment valuations. Unknown prices for proposed new holdings suppress quantity estimates. The UI explains fee exclusions and why buy-only allocation may not reach exact target weights.
- Typecheck passed; lint passed; 40 automated tests passed; production build passed.
- External configuration is unchanged. The expanded authenticated desktop/mobile browser suite is being rerun after form-label corrections.
- Next: watchlist/settings, final filtering/accessibility, complete preview navigation, operational documentation and release validation.
