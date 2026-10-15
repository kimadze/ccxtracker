export interface WatchlistLifecycleItem {
  entryPrice: string | null;
  exitPrice?: string | null;
  targetReachedAt?: string | null;
  sellTargetReachedAt?: string | null;
}
export function watchlistLifecycle(item: WatchlistLifecycleItem) {
  const hasTargets = Boolean(item.entryPrice || item.exitPrice);
  const pending = Boolean(
    (item.entryPrice && !item.targetReachedAt) ||
    (item.exitPrice && !item.sellTargetReachedAt),
  );
  const reached = Boolean(
    (item.entryPrice && item.targetReachedAt) ||
    (item.exitPrice && item.sellTargetReachedAt),
  );
  return { active: !hasTargets || pending, reached };
}
