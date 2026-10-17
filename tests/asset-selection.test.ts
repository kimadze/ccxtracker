import { describe, expect, it } from "vitest";
import { assetSelection } from "@/lib/asset-selection";
import type { Asset } from "@/domain/types";

const coin = (id: string, symbol: string, name = id): Asset => ({
  id,
  symbol,
  name,
  providerId: id,
  isStablecoin: false,
});
describe("asset selection", () => {
  const assets = [
    coin("bitcoin-cash", "BCH"),
    coin("wrapped-bitcoin", "WBTC"),
    coin("bitcoin", "BTC", "Bitcoin"),
    coin("stellar", "XLM"),
    coin("sophiaverse", "SOPH"),
  ];
  it("puts portfolio holdings before a stable popular order", () => {
    expect(
      assetSelection(assets, "", ["sophiaverse"])
        .slice(0, 3)
        .map((a) => a.id),
    ).toEqual(["sophiaverse", "bitcoin", "stellar"]);
  });
  it("ranks exact symbols and IDs before partial matches", () => {
    expect(assetSelection(assets, " bitcoin ")[0].id).toBe("bitcoin");
    expect(assetSelection(assets, "btc")[0].id).toBe("bitcoin");
  });
  it("deduplicates by id but preserves distinct coins with the same symbol", () => {
    const list = assetSelection(
      [...assets, assets[2], coin("another-btc", "BTC")],
      "btc",
    );
    expect(list.filter((a) => a.id === "bitcoin")).toHaveLength(1);
    expect(list.filter((a) => a.symbol === "BTC")).toHaveLength(2);
  });
});
