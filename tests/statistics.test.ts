import { describe, expect, it } from "vitest";
import { latestObservation, percentageChange, topMovers, type MarketStatisticAsset } from "@/domain/statistics";
import { parseFomcMeetings } from "@/server/macro/provider";
import { normalizeCalendar, getEconomicCalendar } from "@/server/macro/calendar";

const asset = (id: string, rank: number, change24h: string | null): MarketStatisticAsset => ({
  id, rank, change24h, symbol: id.toUpperCase(), name: id, image: null,
  price: "1", change1h: null, change7d: null, marketCap: null,
  volume24h: null, circulatingSupply: null, sparkline7d: [],
});

describe("statistics domain", () => {
  it("reads the FED strong-tag markup and keeps date-only precision", () => {
    const events = parseFomcMeetings('<h4>2026 FOMC Meetings</h4><div class="fomc-meeting__month"><strong>September</strong></div><div class="fomc-meeting__date">15-16*</div>', new Date('2026-09-01Z'));
    expect(events).toHaveLength(1);
    expect(events[0].dateOnly).toBe(true);
  });
  it("preserves missing consensus and does not substitute provider forecasts", () => {
    const [event] = normalizeCalendar([{CalendarId: '1', Date:'2026-09-11T12:30:00', Event:'Inflation Rate YoY', Importance:3, Actual:'0%', Previous:'1%', Forecast:'', TEForecast:'2%'}]);
    expect(event.forecast).toBeNull();
    expect(event.actual).toBe('0%');
    expect(event.startsAt).toBe('2026-09-11T12:30:00.000Z');
    expect(event.impact).toBe('high');
  });
  it("reports official calendar coverage as partial", async () => {
    const result = await getEconomicCalendar(async () => [{id:'fed', name:'FED',startsAt:'2026-09-16', impact:'high',source:'FED'}]);
    expect(result.status).toBe('partial');
  });
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
