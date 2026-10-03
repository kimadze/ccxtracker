"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { captureInitialSnapshot } from "@/server/actions";

export function CaptureInitialSnapshot({
  portfolioId,
}: {
  portfolioId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    startTransition(async () => {
      const result = await captureInitialSnapshot(portfolioId);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      router.refresh();
    });
  }, [portfolioId, router]);

  if (message)
    return (
      <p className="mt-2 max-w-sm text-xs text-error" role="status">
        {message}
      </p>
    );
  return (
    <p className="mt-2 text-xs text-base-content/60" role="status">
      {pending ? "მიმდინარე შეფასება ინახება…" : "შეფასება მზადდება…"}
    </p>
  );
}
