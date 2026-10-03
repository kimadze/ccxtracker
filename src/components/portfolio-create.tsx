"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createPortfolio } from "@/server/actions";
import { Field, Message, Modal } from "./ui";
export function PortfolioCreate({
  compact = false,
  onCreated,
}: {
  compact?: boolean;
  onCreated?: () => void;
}) {
  const [open, setOpen] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const router = useRouter();
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          compact
            ? "btn btn-ghost min-h-11 w-full justify-start gap-3 text-xs"
            : "btn btn-primary min-h-11"
        }
      >
        <Plus size={16} />
        პორტფელის შექმნა
      </button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="ახალი პორტფელი"
        description="შექმენით დამოუკიდებელი სივრცე თქვენი საინვესტიციო სტრატეგიისთვის."
      >
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            setError("");
            try {
              const result = await createPortfolio({
                name: new FormData(e.currentTarget).get("name"),
              });
              if (result.ok) {
                setOpen(false);
                onCreated?.();
                router.push(`/portfolios/${result.id}`);
                router.refresh();
              } else setError(result.error);
            } catch {
              setError("პორტფელის შექმნა ვერ მოხერხდა. სცადეთ ხელახლა.");
            } finally {
              setPending(false);
            }
          }}
        >
          <Field label="პორტფელის სახელი">
            <input
              className="input"
              name="name"
              required
              maxLength={60}
              placeholder="მაგ. გრძელვადიანი პორტფელი"
              autoFocus
            />
          </Field>
          <p className="text-xs text-base-content/60">საანგარიშო ვალუტა: USD</p>
          {error && <Message error>{error}</Message>}
          <button
            disabled={pending}
            aria-busy={pending}
            className="btn btn-primary w-full"
          >
            {pending && (
              <span
                className="loading loading-spinner loading-xs"
                aria-hidden="true"
              />
            )}
            პორტფელის შექმნა
          </button>
        </form>
      </Modal>
    </>
  );
}
