import Link from "next/link";
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="flex items-center gap-3"
      aria-label="Crypto Collective X — მთავარი"
    >
      <span className="numeric flex size-8 items-center justify-center rounded-lg bg-brand text-xs font-bold text-white">
        CX
      </span>
      {!compact && (
        <span className="text-[14px] font-semibold leading-[1.45]">
          Crypto Collective X<br/><span className="text-[10px] font-normal text-muted">Portfolio Intelligence</span>
        </span>
      )}
    </Link>
  );
}
