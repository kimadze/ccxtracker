"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { WorkspaceTabs } from "./workspace-tabs";
import { confirmDiscardChanges } from "./unsaved-changes";
export function PlanningTabs({
  tab,
  children,
}: {
  tab: string;
  children: React.ReactNode;
}) {
  const path = usePathname(),
    query = useSearchParams(),
    router = useRouter();
  return (
    <WorkspaceTabs
      label="დაგეგმვის გვერდები"
      value={tab}
      items={[
        ["strategy", "სტრატეგია"],
        ["scenarios", "სცენარები"],
        ["allocation", "განაწილება"],
      ]}
      onChange={(next) => {
        if (next === tab || !confirmDiscardChanges()) return false;
        const params = new URLSearchParams(query.toString());
        params.set("tab", next);
        router.push(`${path}?${params}`, { scroll: false });
        return true;
      }}
    >
      <div key={tab}>{children}</div>
    </WorkspaceTabs>
  );
}
