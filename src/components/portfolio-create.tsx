"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createPortfolio } from "@/server/actions";
import { Field, Message, Modal } from "./ui";
export function PortfolioCreate({ compact = false, onCreated }: { compact?: boolean; onCreated?: () => void }) {
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
            ? "flex w-full items-center gap-3 px-3 py-3 text-xs text-brand"
            : "button-primary"
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
          className="space-y-5"
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
              name="name"
              required
              maxLength={60}
              placeholder="მაგ. გრძელვადიანი პორტფელი"
              autoFocus
            />
          </Field>
          <p className="text-xs text-muted">საანგარიშო ვალუტა: USD</p>
          {error && <Message error>{error}</Message>}
          <button disabled={pending} className="button-primary w-full">
            {pending ? "იქმნება…" : "პორტფელის შექმნა"}
          </button>
        </form>
      </Modal>
    </>
  );
}
