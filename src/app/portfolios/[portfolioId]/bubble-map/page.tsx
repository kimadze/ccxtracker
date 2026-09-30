import { redirect } from "next/navigation";

export default async function Page({
  params,
}: {
  params: Promise<{ portfolioId: string }>;
}) {
  const { portfolioId } = await params;
  redirect(`/portfolios/${portfolioId}/allocation`);
}
