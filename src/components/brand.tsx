import Link from "next/link";
import Image from "next/image";

export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <span
      className="relative block shrink-0 overflow-hidden rounded-lg bg-black"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Image
        src="/ccx-collective-logo.png"
        alt=""
        fill
        sizes={`${size}px`}
        className="object-cover"
        priority
      />
    </span>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2.5 text-foreground" aria-label="Crypto Collective X — მთავარი">
      <span className="grid size-9 shrink-0 place-items-center"><BrandMark size={33} /></span>
      {!compact && <span className="brand-name min-w-0 text-[13px] font-semibold leading-[1.3] tracking-tight">
        Crypto<br />Collective X
      </span>}
    </Link>
  );
}
