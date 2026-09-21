import Link from "next/link";

export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M22 7.5a13 13 0 1 0 0 25" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M24.5 12l11 16M35.5 12l-11 16" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M24.5 12l4.7 6.8" stroke="var(--accent)" strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2.5 text-foreground" aria-label="Crypto Collective X — მთავარი">
      <span className="grid size-9 shrink-0 place-items-center text-brand"><BrandMark size={33} /></span>
      {!compact && <span className="brand-name min-w-0 text-[13px] font-semibold leading-[1.3] tracking-tight">
        Crypto<br />Collective X
      </span>}
    </Link>
  );
}
