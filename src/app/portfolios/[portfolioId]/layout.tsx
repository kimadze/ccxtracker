import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { portfolioService, AccessError } from "@/server/services/portfolio";
import { notFound } from "next/navigation";
import { ZodError } from "zod";
import { Shell } from "@/components/shell";
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ portfolioId: string }>;
}) {
  const user = await requireUser();
  const service = portfolioService(getDb(), user.id);
  await service.owned((await params).portfolioId).catch((error) => {
    if (error instanceof AccessError || error instanceof ZodError) notFound();
    throw error;
  });
  return (
    <Shell userName={user.name} portfolios={await service.list()}>
      {children}
    </Shell>
  );
}
