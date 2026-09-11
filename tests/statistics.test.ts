import { describe, expect, it } from "vitest";
import { latestObservation, percentageChange, topMovers, type MarketStatisticAsset } from "@/domain/statistics";
import { parseFomcMeetings } from "@/server/macro/provider";

const asset = (id: string, rank: number, change24h: string | null): MarketStatisticAsset => ({
  id, rank, change24h, symbol: id.toUpperCase(), name: id, image: null,
  price: "1", change1h: null, change7d: null, marketCap: null,
  volume24h: null, circulatingSupply: null, sparkline7d: [],
});

describe("statistics domain", () => {
  it("ranks gainers and losers within the supplied top-100 universe", () => {
    const result = topMovers([asset("a", 1, "2"), asset("b", 2, "-7"), asset("c", 3, "5"), asset("d", 4, null)], 2);
    expect(result.gainers.map((item) => item.id)).toEqual(["c", "a"]);
    expect(result.losers.map((item) => item.id)).toEqual(["b", "a"]);
  });
  it("calculates percentage changes without dividing by zero", () => {
    expect(percentageChange("110", "100")).toBe("10.000000");
    expect(percentageChange("1", "0")).toBeNull();
  });
  it("ignores unavailable observations", () => {
    expect(latestObservation([{ date: "2026-01", value: "2" }, { date: "2026-02", value: "." }])).toEqual({ date: "2026-01", value: "2" });
  });
  it("maps future FOMC dates from the official calendar markup", () => {
    const html = `<h4>2026 FOMC Meetings</h4><div class="fomc-meeting__month">September</div><div class="fomc-meeting__date">15-16*</div><h4>2027 FOMC Meetings</h4><div class="fomc-meeting__month">January</div><div class="fomc-meeting__date">26-27</div>`;
    const events = parseFomcMeetings(html, new Date("2026-09-01T00:00:00Z"));
    expect(events.map((event) => event.startsAt)).toEqual(["2026-09-16T12:00:00.000Z", "2027-01-27T12:00:00.000Z"]);
  });
});
