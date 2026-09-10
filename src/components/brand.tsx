import Link from "next/link";
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="flex items-center gap-3"
      aria-label="Crypto Collective X — მთავარი"
    >
      <span className="flex size-9 items-center justify-center rounded-lg border border-brand/25 bg-brand/10 text-xl font-bold text-brand">
        X
      </span>
      {!compact && (
        <span className="text-[11px] font-semibold leading-[1.55] tracking-[.14em]">
          CRYPTO
          <br />
          <span className="text-muted">COLLECTIVE X</span>
        </span>
      )}
    </Link>
  );
}
