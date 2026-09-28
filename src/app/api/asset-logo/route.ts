import { NextRequest, NextResponse } from "next/server";

const allowedHosts = new Set([
  "assets.coingecko.com",
  "coin-images.coingecko.com",
]);

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get("url");
  if (!source) return new NextResponse("Missing image URL", { status: 400 });

  let url: URL;
  try { url = new URL(source); } catch { return new NextResponse("Invalid image URL", { status: 400 }); }
  if (url.protocol !== "https:" || !allowedHosts.has(url.hostname)) return new NextResponse("Image host is not allowed", { status: 403 });

  const response = await fetch(url, { next: { revalidate: 86400 } });
  if (!response.ok) return new NextResponse("Image is unavailable", { status: 502 });
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) return new NextResponse("Invalid image response", { status: 415 });
  const body = await response.arrayBuffer();
  if (body.byteLength > 2_000_000) return new NextResponse("Image is too large", { status: 413 });

  return new NextResponse(body, { headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable" } });
}
