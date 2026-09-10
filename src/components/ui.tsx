"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { clsx } from "clsx";
import type { ReactNode } from "react";

export function Modal({ open, onOpenChange, title, description, children, wide = false }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; children: ReactNode; wide?: boolean }) {
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" /><Dialog.Content className={clsx("fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-2xl sm:p-8", wide ? "max-w-2xl" : "max-w-lg")}><Dialog.Title className="pr-8 text-lg font-semibold">{title}</Dialog.Title><Dialog.Description className="mt-2 text-xs leading-6 text-muted">{description}</Dialog.Description><Dialog.Close className="absolute right-5 top-5 rounded p-1 text-muted hover:text-foreground" aria-label="დახურვა"><X size={18} /></Dialog.Close><div className="mt-6">{children}</div></Dialog.Content></Dialog.Portal></Dialog.Root>;
}
export function Message({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <p role={error ? "alert" : "status"} className={clsx("rounded-lg border p-3 text-xs leading-6", error ? "border-negative/20 bg-negative/5 text-negative" : "border-brand/20 bg-brand/5 text-brand")}>{children}</p>;
}
export function Field({ label, children }: { label: string; children: ReactNode }) { return <label><span className="field-label">{label}</span>{children}</label>; }
