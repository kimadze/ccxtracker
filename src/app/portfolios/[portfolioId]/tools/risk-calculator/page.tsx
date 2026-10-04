import type { Metadata } from "next";
import { PageHeading } from "@/components/shell";
import { RiskCalculator } from "@/components/risk-calculator";

export const metadata: Metadata = { title: "Risk Calculator" };
export default function Page() {
  return (
    <>
      <PageHeading
        eyebrow=""
        title="რისკის კალკულატორი"
        description="Prop Risk Calculator"
      />
      <RiskCalculator />
    </>
  );
}
