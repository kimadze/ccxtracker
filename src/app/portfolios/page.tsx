import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { portfolioService } from "@/server/services/portfolio";
import { PortfolioCreate } from "@/components/portfolio-create";
import { Brand } from "@/components/brand";
export default async function Portfolios() {
  const user = await requireUser(); const portfolios = await portfolioService(getDb(), user.id).list();
  if (portfolios.length) redirect(`/portfolios/${portfolios[0].id}`);
  return <main id="main" className="flex min-h-dvh flex-col items-center justify-center gap-8 p-6 text-center"><Brand /><div className="panel max-w-xl p-10"><p className="eyebrow">პირველი ნაბიჯი</p><h1 className="mt-4 text-2xl font-semibold">ჯერ არ გაქვთ შექმნილი პორტფელი</h1><p className="mt-4 mb-8 text-sm leading-7 text-muted">შექმენით პორტფელი, დაამატეთ აქტივები და მიიღეთ თქვენი ინვესტიციების სრული სურათი.</p><PortfolioCreate /></div></main>;
}
