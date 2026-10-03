import { describe, expect, it } from "vitest";
import {
  latestObservation,
  percentageChange,
  topMovers,
  marketBreadth,
  observationHistory,
  type MarketStatisticAsset,
} from "@/domain/statistics";

const asset = (
  id: string,
  rank: number,
  change24h: string | null,
): MarketStatisticAsset => ({
  id,
  rank,
  change24h,
  symbol: id.toUpperCase(),
  name: id,
  image: null,
  price: "1",
  change1h: null,
  change7d: null,
  marketCap: null,
  volume24h: null,
  circulatingSupply: null,
  sparkline7d: [],
});

describe("statistics domain", () => {
  it("ranks gainers and losers within the supplied top-100 universe", () => {
    const result = topMovers(
      [
        asset("a", 1, "2"),
        asset("b", 2, "-7"),
        asset("c", 3, "5"),
        asset("d", 4, null),
      ],
      2,
    );
    expect(result.gainers.map((item) => item.id)).toEqual(["c", "a"]);
    expect(result.losers.map((item) => item.id)).toEqual(["b"]);
  });
  it("calculates percentage changes without dividing by zero", () => {
    expect(percentageChange("110", "100")).toBe("10.000000");
    expect(percentageChange("1", "0")).toBeNull();
  });
  it("ignores unavailable observations", () => {
    expect(
      latestObservation([
        { date: "2026-01", value: "2" },
        { date: "2026-02", value: "." },
      ]),
    ).toEqual({ date: "2026-01", value: "2" });
  });
  it("uses the chosen period and excludes stablecoins without treating missing data as flat", () => {
    const rows = [
      asset("rise", 1, "2"),
      asset("fall", 2, "-2"),
      asset("flat", 3, "0"),
      asset("missing", 4, null),
      asset("stable", 5, "1"),
    ];
    rows[0].change7d = "-10";
    rows[1].change7d = "8";
    expect(marketBreadth(rows, "24h", ["stable"])).toEqual({
      rising: 1,
      falling: 1,
      unchanged: 1,
      missing: 1,
      covered: 3,
      total: 4,
    });
    expect(topMovers(rows, 3, "7d").gainers.map((row) => row.id)).toEqual([
      "fall",
    ]);
    expect(topMovers(rows, 3, "7d").losers.map((row) => row.id)).toEqual([
      "rise",
    ]);
    expect(topMovers(rows, 3, "1h")).toEqual({ gainers: [], losers: [] });
  });
  it("compares annual inflation to the same calendar month despite gaps", () => {
    const observations = [
      { date: "2025-01-01", value: "100" },
      { date: "2025-02-01", value: "200" },
      { date: "2025-03-01", value: "." },
      { date: "2026-01-01", value: "110" },
      { date: "2026-02-01", value: "220" },
      { date: "2026-03-01", value: "230" },
      { date: "2026-04-01", value: "" },
    ];
    expect(observationHistory(observations, "yoy")).toEqual([
      { date: "2026-01-01", value: "10.000000" },
      { date: "2026-02-01", value: "10.000000" },
    ]);
    expect(
      observationHistory(
        [
          { date: "2025-12-01", value: "100" },
          { date: "2026-01-01", value: "110" },
        ],
        "mom",
      ),
    ).toEqual([{ date: "2026-01-01", value: "10.000000" }]);
    expect(latestObservation([{ date: "2026-01-01", value: " " }])).toBeNull();
  });
});
