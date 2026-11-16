import { requireUser } from "@/server/auth";
import { getAssetMarketStatistics } from "@/server/market/statistics";

export async function GET(request: Request) {
  await requireUser();
  const asset = new URL(request.url).searchParams.get("asset");
  if (!asset || !/^[a-z0-9-]{1,120}$/.test(asset)) {
    return Response.json({ prices: [] }, { status: 400 });
  }
  const [stats] = await getAssetMarketStatistics([asset]);
  return Response.json({ prices: stats?.sparkline7d.slice(-168) ?? [] });
}
