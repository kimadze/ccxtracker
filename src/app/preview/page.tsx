import { Shell, PageHeading } from "@/components/shell";
import { Overview } from "@/components/overview";
import { demoSummary, demoHistory } from "@/domain/demo";
import { HistoryChart } from "@/components/history-chart";
import Link from "next/link";
export default function Preview() { return <Shell preview portfolios={[{ id: "preview", name: "მთავარი პორტფელი" }]} userName="დამთვალიერებელი"><PageHeading eyebrow="მთავარი პორტფელი" title="პორტფელის მიმოხილვა" description="თქვენი ინვესტიციები — ერთიან და მკაფიო სურათში." action={<Link className="button-primary" href="/login">საკუთარი პორტფელის შექმნა</Link>} /><Overview summary={demoSummary} base="/preview" preview history={<HistoryChart snapshots={demoHistory} illustrative />} /></Shell>; }
