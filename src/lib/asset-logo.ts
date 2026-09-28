/**
 * CoinGecko search results often use tiny `thumb` files.  Their CDN keeps the
 * same image at `large`, so normalize the path without adding an API request.
 */
export function highResLogoUrl(url: string | null | undefined) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const isCoinGecko =
      parsed.hostname === "assets.coingecko.com" ||
      parsed.hostname === "coin-images.coingecko.com";
    if (!isCoinGecko) return url;
    parsed.pathname = parsed.pathname
      .replace("/thumb/", "/large/")
      .replace("/small/", "/large/");
    return parsed.toString();
  } catch {
    return url;
  }
}
