import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { portfolioService } from "@/server/services/portfolio";
import { Shell } from "@/components/shell";
export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ portfolioId: string }> }) {
  const user = await requireUser(); const service = portfolioService(getDb(), user.id);
  await service.owned((await params).portfolioId);
  return <Shell userName={user.name} portfolios={await service.list()}>{children}</Shell>;
}
