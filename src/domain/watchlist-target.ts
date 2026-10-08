import { decimal } from "./decimal";
import type { Quote } from "./types";
export function targetTransition(
  target: string | null,
  active: boolean,
  lastQuoteAt: Date | null,
  quote: Quote | undefined,
  now = Date.now(),
  direction: "buy" | "sell" = "buy",
) {
  if (!target || !quote || quote.stale || !quote.price) return null;
  const time = Date.parse(quote.updatedAt);
  if (
    !Number.isFinite(time) ||
    now - time > 900000 ||
    time > now + 60000 ||
    (lastQuoteAt && time <= lastQuoteAt.getTime()) ||
    decimal(quote.price).lte(0)
  )
    return null;
  const reached =
    direction === "buy"
      ? decimal(quote.price).lte(target)
      : decimal(quote.price).gte(target);
  return {
    active: reached,
    // The first valid quote establishes a baseline, never an arrival alert.
    notify: lastQuoteAt !== null && reached && !active,
    quoteAt: new Date(time),
    price: quote.price,
  };
}
