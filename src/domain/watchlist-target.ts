import { decimal } from "./decimal";
import type { Quote } from "./types";
export function targetTransition(
  target: string | null,
  active: boolean,
  lastQuoteAt: Date | null,
  quote: Quote | undefined,
  now = Date.now(),
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
  const reached = decimal(quote.price).lte(target);
  return {
    active: reached,
    notify: reached && !active,
    quoteAt: new Date(time),
    price: quote.price,
  };
}
