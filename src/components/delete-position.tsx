"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { deletePosition } from "@/server/actions";
import { Modal, Message } from "./ui";
export function DeletePosition({
  portfolioId,
  assetId,
  revision,
}: {
  portfolioId: string;
  assetId: string;
  revision: number;
}) {
  const [open, setOpen] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const router = useRouter();
  return (
    <>
      <button
        className="button-danger"
        onClick={() => {
          setOpen(true);
          setError("");
        }}
      >
        პოზიციის წაშლა
      </button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="პოზიციის წაშლა"
        description="ამ აქტივის ტრანზაქციები წაიშლება და პორტფელი თავიდან გამოითვლება. საინვესტიციო ჟურნალი შენარჩუნდება. თუ სხვა ტრანზაქციები ამ აქტივის გაყიდვით მიღებულ თანხას ეყრდნობა, წაშლა ვერ შესრულდება."
      >
        <form
          className="space-y-5"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            try {
              const result = await deletePosition(
                portfolioId,
                assetId,
                revision,
              );
              if (result.ok) {
                router.replace(`/portfolios/${portfolioId}/positions`);
                router.refresh();
              } else setError(result.error);
            } catch {
              setError("წაშლა ვერ მოხერხდა.");
            } finally {
              setPending(false);
            }
          }}
        >
          <label className="flex items-center gap-3 text-xs">
            <input type="checkbox" required />
            ვადასტურებ პოზიციის ისტორიის წაშლას.
          </label>
          {error && <Message error>{error}</Message>}
          <button className="button-danger" disabled={pending}>
            {pending ? "იშლება…" : "წაშლა"}
          </button>
        </form>
      </Modal>
    </>
  );
}
