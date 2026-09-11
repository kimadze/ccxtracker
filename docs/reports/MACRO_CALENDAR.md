# Macro calendar update

The macro tab now uses a grouped event calendar with category, date-range and importance filters. Amber marks high importance, violet marks medium importance and today's date, and gray marks low importance. Labels convey importance independently of color. Economic metrics are available in an expandable section.

Fixed the Federal Reserve HTML parser to read month names wrapped in strong tags. Verified the parser against the live official page: eight meetings in each of 2026 and 2027. Official schedule entries have date-only precision and never display an invented release hour.

The optional server-only `TRADING_ECONOMICS_API_KEY` enables the US economic calendar and provider-supplied Actual, Previous and Forecast values. Configure it in local environment and Vercel with a subscription that permits the intended use. No paid subscription was created. The provider integration has normalized-payload tests, but live authenticated Trading Economics access has not been verified without credentials. Missing consensus is never replaced by TEForecast. Without a working provider, the official FED schedule remains available with a partial-coverage notice. BLS automated retrieval returned Access Denied and is not used as a dependency.

Calendar dates are grouped in Asia/Tbilisi, including day rollover. Date-only FED entries retain their calendar date. Preview events and consensus are fictional fixtures under the existing preview banner. No production values are manually entered and no database migration is needed.

Validation includes parser/normalization tests and browser checks for category filtering and mobile overflow. The economic-calendar API is refreshed on requests using five-minute Next fetch revalidation; this is not a push subscription. FED schedules revalidate daily.
