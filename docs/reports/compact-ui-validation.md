# Compact DaisyUI workspace validation

## Scope

Dark CCX workspace UI: shared shell/forms, portfolio list, positions and four detail tabs, transactions, watchlist, airdrops, journal, analytics, three statistics tabs, allocation, strategy, scenarios, settings and public entry/error/loading screens. API handlers, database schema and financial domain calculations are unchanged.

Compact lists replace repeated cards; secondary metrics and explanations use disclosures. Mobile retains its five-item navigation and safe-area spacing. Desktop retains the native collapsible icon drawer. Obsolete global form/card overrides and the footer-hiding rule were removed.

## Automated coverage

- TypeScript and production build: passed.
- ESLint: passed.
- Financial/unit tests: 68 tests across 11 files passed.
- Desktop browser suite: five tests passed, including persisted workflows, public screens and empty workspaces.
- Final mobile run: responsive screenshot/form/share matrix and persisted portfolio workflow both passed (2 tests). This includes allocation saving and navigation through the More dialog.
- Responsive screenshot matrix: 360, 390, 430, 768, 1024 and 1440px across workspace routes and position/statistics tabs. Page horizontal overflow is asserted.
- Transaction forms: six types, responsive opening/closing, privacy and existing validation.
- Share dialog: three templates, preview and PNG download. PNG rendering designs are unchanged.
- Keyboard tab navigation, legacy `tab=dca` / `tab=exit`, More-menu navigation and Bubble Map redirect are covered.

Screenshots and Playwright traces are local artifacts in `.local` and `test-results`, not repository assets. Browser workflows use an isolated PGlite database and disposable test sessions; no production financial records are written.

## Limits

The isolated test server disables external market credentials, so market statistics and macro sources exercise their unavailable-data states locally. A browser viewport test cannot reproduce a physical phone's software keyboard; modal height, scrolling, focus and navigation clearance are checked in browser emulation.
