import { decimal } from "./decimal";
import { usableAlertQuote } from "./alert-quote";
import type { Asset, Quote } from "./types";
export type NextStep = {
  id: string;
  asset: Asset;
  kind: "tp" | "rise" | "fall";
  level?: number;
  target: string;
  current: string | null;
  distance: string | null;
  reached: boolean;
  share: string | null;
};
export function rankNextSteps(rows: NextStep[], quotes: Quote[], now: number) {
  return rows
    .map((row) => {
      const quote = quotes.find((q) => q.assetId === row.asset.id);
      const current = usableAlertQuote(quote, now) ? quote!.price : null;
      return {
        ...row,
        current,
        distance: current
          ? decimal(row.target).minus(current).div(current).mul(100).toFixed()
          : null,
      };
    })
    .sort((a, b) => {
      if (a.reached !== b.reached) return Number(a.reached) - Number(b.reached);
      if (a.distance === null || b.distance === null)
        return (
          Number(a.distance === null) - Number(b.distance === null) ||
          a.id.localeCompare(b.id)
        );
      return (
        decimal(a.distance).abs().cmp(decimal(b.distance).abs()) ||
        a.id.localeCompare(b.id)
      );
    });
}
