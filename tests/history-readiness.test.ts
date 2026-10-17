import { expect, it } from "vitest";
import { historyWindow } from "@/domain/history-window";
import { takeProfitDeliveryReadiness } from "@/domain/telegram-readiness";
it("anchors real history periods to today, while explicitly illustrative history retains its reference date", () => {
  const points = [
    { capturedAt: "2026-10-12T00:00:00Z", value: "100" },
    { capturedAt: "2026-10-12T12:00:00Z", value: "110" },
  ];
  const now = Date.parse("2026-10-17T00:00:00Z");
  expect(historyWindow(points, "1D", now)).toMatchObject({
    snapshots: [],
    stale: true,
  });
  expect(historyWindow(points, "ALL", now).snapshots).toHaveLength(2);
  expect(historyWindow(points, "1D", now, true)).toMatchObject({
    snapshots: points,
    stale: false,
  });
  expect(
    historyWindow([{ capturedAt: "invalid", value: "1" }], "ALL", now),
  ).toMatchObject({ snapshots: [], latest: null, stale: false });
});
it("uses the same readiness conditions for UI, assistant and TP workers", () => {
  const ready = { chatId: "123", portfolioIds: ["p"], sellEnabled: true };
  expect(takeProfitDeliveryReadiness(ready, "p")).toBe("ready");
  expect(takeProfitDeliveryReadiness(null, "p")).toBe("disconnected");
  expect(
    takeProfitDeliveryReadiness({ ...ready, lastError: "BOT_BLOCKED" }, "p"),
  ).toBe("blocked");
  expect(takeProfitDeliveryReadiness({ ...ready, portfolioIds: [] }, "p")).toBe(
    "portfolio-disabled",
  );
  expect(
    takeProfitDeliveryReadiness({ ...ready, sellEnabled: false }, "p"),
  ).toBe("sell-disabled");
  expect(
    takeProfitDeliveryReadiness(
      { connected: true, portfolioIds: ["p"], sellEnabled: true },
      "p",
    ),
  ).toBe("ready");
});
