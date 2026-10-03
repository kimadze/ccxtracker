import Link from "next/link";
import Image from "next/image";

export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <span
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Image
        src="/ccx-mark-transparent.png"
        alt=""
        fill
        sizes={`${size}px`}
        className="object-contain"
        priority
      />
    </span>
  );
}

export function Brand({
  compact = false,
  href = "/",
  label = "Crypto Collective X — მთავარი",
}: {
  compact?: boolean;
  href?: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-w-0 items-center gap-2.5 text-base-content"
      aria-label={label}
    >
      <span className="grid size-9 shrink-0 place-items-center">
        <BrandMark size={33} />
      </span>
      {!compact && (
        <span className="brand-name min-w-0 whitespace-nowrap text-[13px] font-semibold leading-none tracking-[-.025em]">
          Crypto Collective <b>X</b>
        </span>
      )}
    </Link>
  );
}
