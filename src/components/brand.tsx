import Link from "next/link";

export function Brand({ compact = false, variant = "default" }: { compact?: boolean; variant?: "default" | "topbar" }) {
  return <Link href="/" className={`ccx-brand ${variant === "topbar" ? "ccx-brand--topbar" : ""}`} aria-label="Crypto Collective X — მთავარი"><span className="ccx-brand__mark"><b>C</b><i>X</i></span>{!compact && <span className="ccx-brand__copy">Crypto Collective X{variant !== "topbar" && <small>Portfolio Intelligence</small>}</span>}</Link>;
}
