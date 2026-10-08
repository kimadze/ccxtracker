"use client";
import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { WorkspaceTabs } from "./workspace-tabs";
export function PlanningTabs({
  tab,
  children,
}: {
  tab: string;
  children: React.ReactNode;
}) {
  const dirty = useRef(false);
  const path = usePathname(),
    query = useSearchParams(),
    router = useRouter();
  useEffect(() => {
    dirty.current = false;
    const saved = () => {
      dirty.current = false;
    };
    const unload = (event: BeforeUnloadEvent) => {
      if (dirty.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("ccx-planning-saved", saved);
    const changed = () => {
      dirty.current = true;
    };
    window.addEventListener("ccx-planning-changed", changed);
    window.addEventListener("beforeunload", unload);
    return () => {
      window.removeEventListener("ccx-planning-saved", saved);
      window.removeEventListener("ccx-planning-changed", changed);
      window.removeEventListener("beforeunload", unload);
    };
  }, [tab]);
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
        if (
          next === tab ||
          (dirty.current &&
            !window.confirm("ცვლილებები შეუნახავია. გსურთ ტაბის დატოვება?"))
        )
          return;
        const params = new URLSearchParams(query.toString());
        params.set("tab", next);
        router.push(`${path}?${params}`, { scroll: false });
      }}
    >
      <div
        key={tab}
        onChangeCapture={(event) => {
          const target = event.target as HTMLElement;
          if (
            ["პოზიციის არჩევა", "შენახული სცენარი"].includes(
              target.getAttribute("aria-label") ?? "",
            )
          )
            return;
          dirty.current = true;
        }}
      >
        {children}
      </div>
    </WorkspaceTabs>
  );
}
