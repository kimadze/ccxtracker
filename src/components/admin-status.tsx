import type { AdminStatus } from "@/lib/admin-presentation";

const tones = {
  success: "badge-success",
  info: "badge-info",
  warning: "badge-warning",
  error: "badge-error",
  neutral: "badge-ghost",
  primary: "badge-primary",
};
export function AdminStatusBadge({ label, tone, pending }: AdminStatus) {
  return (
    <span
      className={`badge badge-sm h-auto max-w-full whitespace-normal py-1 text-left leading-snug ${pending ? "badge-dash" : tone === "neutral" ? "" : "badge-soft"} ${tones[tone]}`}
    >
      {label}
    </span>
  );
}
