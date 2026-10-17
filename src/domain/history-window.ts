import type { Snapshot } from "./analytics";
export type HistoryPeriod = "1D" | "7D" | "1M" | "3M" | "1Y" | "ALL";
export function historyWindow(
  snapshots: Pick<Snapshot, "capturedAt" | "value">[],
  period: HistoryPeriod,
  now: number,
  illustrative = false,
) {
  const valid = snapshots.filter((s) =>
    Number.isFinite(Date.parse(s.capturedAt)),
  );
  const latest = valid.reduce(
    (last, s) => Math.max(last, Date.parse(s.capturedAt)),
    0,
  );
  const days = {
    "1D": 1,
    "7D": 7,
    "1M": 30,
    "3M": 90,
    "1Y": 365,
    ALL: Infinity,
  }[period];
  const anchor = illustrative ? latest : now;
  return {
    latest: latest || null,
    stale:
      !illustrative && now > 0 && latest > 0 && now - latest > 36 * 3600000,
    snapshots: valid.filter(
      (s) =>
        days === Infinity ||
        Date.parse(s.capturedAt) >= anchor - days * 86400000,
    ),
  };
}
