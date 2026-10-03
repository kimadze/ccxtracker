"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createPortfolio } from "@/server/actions";
import { createWalletPortfolio } from "@/server/wallet-actions";
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
  const [kind, setKind] = useState("manual");
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
              const data = new FormData(e.currentTarget);
              const result =
                kind === "manual"
                  ? await createPortfolio({ name: data.get("name") })
                  : await createWalletPortfolio({
                      name: data.get("name"),
                      network: kind,
                      addresses: String(data.get("addresses") ?? "")
                        .split(/\r?\n/)
                        .map((a) => a.trim())
                        .filter(Boolean),
                    });
              if (result.ok) {
                setOpen(false);
                onCreated?.();
                router.push(
                  `${kind === "manual" ? "/portfolios" : "/wallet-portfolios"}/${result.id}`,
                );
                router.refresh();
              } else setError(result.error);
            } catch {
              setError("პორტფელის შექმნა ვერ მოხერხდა. სცადეთ ხელახლა.");
            } finally {
              setPending(false);
            }
          }}
        >
          <Field label="პორტფელის ტიპი">
            <select
              className="select w-full"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              disabled={pending}
            >
              <option value="manual">ხელით მართული</option>
              <option value="stellar">Stellar · Read-only</option>
              <option value="bitcoin">Bitcoin · Read-only</option>
            </select>
          </Field>
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
          {kind !== "manual" && (
            <Field label="საჯარო მისამართები">
              <textarea
                className="textarea w-full font-mono text-xs"
                name="addresses"
                required
                rows={3}
                maxLength={1000}
                placeholder={
                  kind === "stellar"
                    ? "G…\nთითო მისამართი ახალ ხაზზე"
                    : "bc1… / 1… / 3…\nთითო მისამართი ახალ ხაზზე"
                }
              />
            </Field>
          )}
          <p className="text-xs text-base-content/60">
            {kind === "manual"
              ? "საანგარიშო ვალუტა: USD"
              : `მხოლოდ Mainnet · მაქსიმუმ 10 მისამართი. გასაღები და ხელმოწერა არ გვჭირდება. მისამართები გადაეცემა ${kind === "stellar" ? "Stellar Horizon-ს" : "mempool.space-ს"}.`}
          </p>
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
