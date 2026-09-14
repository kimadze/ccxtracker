import Link from "next/link";
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="flex items-center gap-3"
      aria-label="Crypto Collective X — მთავარი"
    >
      <span className="numeric flex size-8 items-center justify-center rounded-md bg-gradient-to-br from-brand to-[var(--gold-deep)] text-xs font-bold text-background">
        CX
      </span>
      {!compact && (
        <span className="text-[13px] font-semibold leading-[1.45]">
          Crypto Collective X<br/><span className="text-[11px] font-normal text-muted">პორტფელის მართვა</span>
        </span>
      )}
    </Link>
  );
}
