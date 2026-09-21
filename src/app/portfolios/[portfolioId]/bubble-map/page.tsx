import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeading } from "@/components/shell";
import { PortfolioBubbleMap } from "@/components/portfolio-bubble-map";
import { loadWorkspace } from "@/server/workspace";

export default async function Page({ params }: { params: Promise<{ portfolioId: string }> }) {
  const { portfolioId } = await params;
  const workspace = await loadWorkspace(portfolioId);
  return <>
    <PageHeading
      eyebrow={workspace.portfolio.name}
      title="პოზიციების Bubble Map"
      description="თქვენი არასტეიბლ კრიპტოაქტივების ვიზუალური განაწილება და მიმდინარე მოძრაობა."
      action={<Link href={`/portfolios/${portfolioId}`} className="button-secondary"><ArrowLeft size={15} />მიმოხილვაზე დაბრუნება</Link>}
    />
    <PortfolioBubbleMap positions={workspace.summary.positions} />
  </>;
}
