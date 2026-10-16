import { beforeEach, afterEach, it, expect, vi } from "vitest";
const state = vi.hoisted(() => ({
  refresh: vi.fn(),
  cleanup: undefined as undefined | (() => void),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: state.refresh }),
}));
vi.mock("react", () => ({
  useEffect: (effect: () => () => void) => {
    state.cleanup = effect();
  },
}));
import { useMarketRefresh } from "@/components/use-market-refresh";
let doc: EventTarget & {
  hidden: boolean;
  querySelector: ReturnType<typeof vi.fn>;
  activeElement: null | { matches: () => boolean };
};
beforeEach(() => {
  vi.useFakeTimers();
  state.refresh.mockReset();
  doc = Object.assign(new EventTarget(), {
    hidden: false,
    querySelector: vi.fn().mockReturnValue(null),
    activeElement: null,
  });
  vi.stubGlobal("document", doc);
  vi.stubGlobal(
    "window",
    Object.assign(new EventTarget(), { setInterval, clearInterval }),
  );
});
afterEach(() => {
  state.cleanup?.();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("refreshes idle valuations every minute and removes the timer on navigation", () => {
  useMarketRefresh("/portfolios/test");
  vi.advanceTimersByTime(59999);
  expect(state.refresh).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(state.refresh).toHaveBeenCalledTimes(1);
  state.cleanup?.();
  vi.advanceTimersByTime(60000);
  expect(state.refresh).toHaveBeenCalledTimes(1);
});
it("defers while hidden, while a dialog is open, or while editing", () => {
  useMarketRefresh("/portfolios/test");
  doc.hidden = true;
  vi.advanceTimersByTime(60000);
  doc.hidden = false;
  doc.querySelector.mockReturnValue({ open: true });
  vi.advanceTimersByTime(60000);
  doc.querySelector.mockReturnValue(null);
  doc.activeElement = { matches: () => true };
  vi.advanceTimersByTime(60000);
  expect(state.refresh).not.toHaveBeenCalled();
  doc.activeElement = null;
  doc.dispatchEvent(new Event("visibilitychange"));
  expect(state.refresh).toHaveBeenCalledTimes(1);
});
