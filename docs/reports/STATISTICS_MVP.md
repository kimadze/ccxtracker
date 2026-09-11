# Statistics MVP implementation report

## Delivered

- Added `/portfolios/[portfolioId]/statistics` and the matching public preview workspace.
- Added one Statistics navigation item with Crypto Market, Macro and My Portfolio tabs.
- Extended the provider-neutral domain with normalized market overview, market-asset, macro-indicator and economic-event types.
- Added CoinGecko-backed global market metrics and a market-cap-ranked top-100 asset request.
- Calculated top gainers and losers only from the returned top-100 market-cap universe.
- Added market search, sorting, 1h/24h/7d change, market cap, volume and seven-day sparklines.
- Reused canonical asset identifiers, the existing watchlist and existing portfolio allocations for owned/tracked indicators.
- Added dynamic FRED macro series for the effective federal funds rate, headline/core CPI YoY, unemployment, GDP growth, 2Y/10Y Treasury yields and the broad US dollar index.
- Organized dynamic FRED indicators into Monetary Policy, Inflation, Labor Market, and Growth & Market Conditions cards.
- Added source and observation/update timestamps and explicit unavailable states.
- Added portfolio context for BTC, ETH, other crypto, stablecoins and USD cash.

## Caching and failure behavior

- CoinGecko market data uses server-side five-minute revalidation and batched market requests.
- FRED series use six-hour revalidation.
- Provider payloads are validated or normalized before reaching UI components.
- Provider errors remain server-side. Widgets show Georgian unavailable states and never substitute demo values in authenticated routes.
- Demo fixtures appear only below `/preview` and are explicitly labeled as fictional by the existing preview shell.

## Validation

- TypeScript passed.
- Targeted ESLint passed.
- Unit/integration suite: 63 tests passed across 10 files.
- Playwright suite: 8 tests passed on desktop and mobile, including all preview widths.
- Next.js production build passed and includes the dynamic Statistics route.

## Current limitations

- CoinGecko market widgets require `COINGECKO_DEMO_API_KEY`.
- The macro workspace intentionally contains indicators only; economic-calendar and consensus features were removed.
- Event market reaction and normalized BTC-versus-macro charts are outside this MVP.
- The existing watchlist is reused for selected assets; favorites and manual reordering are not added in this release.
- FRED's broad trade-weighted US dollar index is labeled accurately and is not presented as DXY.
