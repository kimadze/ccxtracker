# Phase 3 — Position intelligence

Local application checkpoint passed on 2026-09-10.

- Added DCA calculations with fee-inclusive capital, quantity/basis/average changes and externally funded allocation estimates; the planner does not execute transactions.
- Added saved staged exit plans, increasing target prices, fee-adjusted proceeds/profit, remaining holdings, weighted net exit price and capital recovery within a specified level. Percentages reference current holdings, not a diminishing remainder.
- Added position tabs, portfolio strategy/journal workspaces, journal persistence and private attachment upload/download/delete routes. Uploads have an enforced streaming size bound, allowed MIME types and signature checks; nested ownership is checked and downloads are private/no-store attachments.
- Migration `0002_wonderful_maximus.sql` adds exit plans/levels, position journals and attachment metadata. Testing caught a generated composite-FK ordering issue; the required unique index is now created before the foreign key.
- New actions: save exit plan and journal. Plans store price/percentage assumptions; quantities remain ledger-derived.
- Typecheck passed; lint passed; 30 automated tests passed; production build passed. Earlier desktop/mobile public-route browser checks passed (4 tests). Expanded authenticated browser coverage is now being run using an isolated test-only socket database and genuine signed session cookies; no production bypass was added.
- External requirements: a private Vercel Blob store/token or linked store for attachment integration. Live upload/download, Google OAuth callbacks and Neon still need service credentials and deployed verification.
- Next: scenario CRUD, Quick What-If and portfolio goals.
