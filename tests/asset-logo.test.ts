import { describe, expect, it } from "vitest";
import { highResLogoUrl } from "@/lib/asset-logo";

describe("asset logo URLs", () => {
  it("upgrades CoinGecko thumb and small artwork without altering its query", () => {
    expect(highResLogoUrl("https://coin-images.coingecko.com/coins/images/1/thumb/bitcoin.png?x=1")).toBe("https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png?x=1");
    expect(highResLogoUrl("https://assets.coingecko.com/coins/images/1/small/bitcoin.png")).toBe("https://assets.coingecko.com/coins/images/1/large/bitcoin.png");
  });

  it("keeps large, third-party, malformed, and missing sources intact", () => {
    expect(highResLogoUrl("https://assets.coingecko.com/coins/images/1/large/bitcoin.png")).toBe("https://assets.coingecko.com/coins/images/1/large/bitcoin.png");
    expect(highResLogoUrl("https://example.com/token.png")).toBe("https://example.com/token.png");
    expect(highResLogoUrl("not a url")).toBe("not a url");
    expect(highResLogoUrl(null)).toBeNull();
  });
});
