import { redirect } from "next/navigation";
export async function redirectPlanning(
  params: Promise<{ portfolioId: string }>,
  searchParams: Promise<Record<string, string | string[] | undefined>>,
  tab: string,
) {
  const { portfolioId } = await params;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) value.forEach((v) => query.append(key, v));
    else if (value !== undefined) query.set(key, value);
  }
  query.set("tab", tab);
  redirect(`/portfolios/${portfolioId}/planning?${query}`);
}
