import type { Metadata } from "next";
import { requireUser } from "@/server/auth";
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return children;
}
