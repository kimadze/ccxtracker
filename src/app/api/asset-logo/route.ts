import { NextRequest, NextResponse } from "next/server";
import { highResLogoUrl } from "@/lib/asset-logo";

const allowedHosts = new Set([
  "assets.coingecko.com",
  "coin-images.coingecko.com",
]);

export async function GET(request: NextRequest) {
  const source = highResLogoUrl(request.nextUrl.searchParams.get("url"));
  if (!source)
    return new NextResponse("Missing image URL", { status: 400 });

  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return new NextResponse("Invalid image URL", { status: 400 });
  }
  if (url.protocol !== "https:" || !allowedHosts.has(url.hostname))
    return new NextResponse("Image host is not allowed", { status: 403 });

  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 86400 },
    });
    if (!response.ok)
      return new NextResponse("Image is unavailable", { status: 502 });
    const contentType =
      response.headers.get("content-type")?.split(";")[0].trim() ?? "";
    const allowedTypes = new Set([
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
      "image/svg+xml",
    ]);
    if (!allowedTypes.has(contentType))
      return new NextResponse("Invalid image response", { status: 415 });
    const size = Number(response.headers.get("content-length"));
    if (Number.isFinite(size) && size > 2_000_000) {
      await response.body?.cancel();
      return new NextResponse("Image is too large", { status: 413 });
    }
    if (!response.body)
      return new NextResponse("Image is unavailable", { status: 502 });
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 2_000_000) {
        await reader.cancel();
        return new NextResponse("Image is too large", { status: 413 });
      }
      chunks.push(value);
    }
    const body = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
      },
    });
  } catch {
    return new NextResponse("Image is unavailable", { status: 502 });
  }
}
