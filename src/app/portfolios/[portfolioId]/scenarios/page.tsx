import { redirectPlanning } from "@/server/planning-redirect";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ portfolioId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return redirectPlanning(params, searchParams, "scenarios");
}
