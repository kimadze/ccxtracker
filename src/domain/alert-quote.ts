import { decimal } from "./decimal";
import type { Quote } from "./types";

/** A provider observation, not the time it was fetched from our cache. */
export function usableAlertQuote(
  quote: Quote | undefined,
  now = Date.now(),
): quote is Quote & { price: string } {
  if (!quote || quote.stale || !quote.price) return false;
  const time = Date.parse(quote.updatedAt);
  try {
    return (
      Number.isFinite(time) &&
      time <= now + 60000 &&
      now - time <= 900000 &&
      decimal(quote.price).gt(0)
    );
  } catch {
    return false;
  }
}
