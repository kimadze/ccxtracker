import { expect, it } from "vitest";
import { watchlistLifecycle } from "@/domain/watchlist-lifecycle";
it("separates consumed directions while preserving pending directions and unconfigured watch assets", () => {
  expect(watchlistLifecycle({ entryPrice: null })).toEqual({
    active: true,
    reached: false,
  });
  expect(
    watchlistLifecycle({
      entryPrice: "10",
      targetReachedAt: "2026-10-15T10:00:00Z",
    }),
  ).toEqual({ active: false, reached: true });
  expect(
    watchlistLifecycle({
      entryPrice: "10",
      exitPrice: "20",
      targetReachedAt: "2026-10-15T10:00:00Z",
    }),
  ).toEqual({ active: true, reached: true });
  expect(
    watchlistLifecycle({
      entryPrice: "10",
      exitPrice: "20",
      targetReachedAt: "2026-10-15T10:00:00Z",
      sellTargetReachedAt: "2026-10-16T10:00:00Z",
    }),
  ).toEqual({ active: false, reached: true });
});
