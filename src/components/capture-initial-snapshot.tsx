"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, LoaderCircle } from "lucide-react";
import { captureInitialSnapshot } from "@/server/actions";

export function CaptureInitialSnapshot({ portfolioId }: { portfolioId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        className="button-secondary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setMessage(null);
            const result = await captureInitialSnapshot(portfolioId);
            if (!result.ok) {
              setMessage(result.error);
              return;
            }
            router.refresh();
          })
        }
      >
        {pending ? <LoaderCircle size={15} className="animate-spin" /> : <Camera size={15} />}
        {pending ? "შეფასება ინახება…" : "შეფასების შენახვა ახლა"}
      </button>
      {message && <p className="mt-2 max-w-sm text-xs text-negative" role="status">{message}</p>}
    </div>
  );
}
