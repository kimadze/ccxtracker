"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export function MobileMetricCard({ label, value, hint, tone = "" }: { label: string; value: string; hint?: string; tone?: string }) {
  return <article className="mobile-metric-card"><span>{label}</span><strong className={`numeric ${tone}`}>{value}</strong>{hint && <small>{hint}</small>}</article>;
}

export function MobileBottomSheet({ trigger, title, children }: { trigger: ReactNode; title: string; children: ReactNode }) {
  return <Dialog.Root><Dialog.Trigger asChild>{trigger}</Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="mobile-sheet-overlay" /><Dialog.Content className="mobile-bottom-sheet" aria-describedby={undefined}><Dialog.Title>{title}</Dialog.Title><Dialog.Close className="mobile-sheet-close" aria-label="დახურვა"><X size={18} /></Dialog.Close><div className="mobile-sheet-content">{children}</div></Dialog.Content></Dialog.Portal></Dialog.Root>;
}
