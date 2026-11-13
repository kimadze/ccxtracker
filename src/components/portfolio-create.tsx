"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus } from "lucide-react";
import { createPortfolio } from "@/server/actions";
import { createWalletPortfolio } from "@/server/wallet-actions";
import { portfolioSchema, positiveAmount } from "@/domain/validation";
import { Field, Message, Modal } from "./ui";
export function PortfolioCreate({
  compact = false,
  firstPortfolio = false,
  onCreated,
}: {
  compact?: boolean;
  firstPortfolio?: boolean;
  onCreated?: () => void;
}) {
  const [open, setOpen] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const router = useRouter();
  const [kind, setKind] = useState("manual");
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [capital, setCapital] = useState("");
  const [requestId, setRequestId] = useState<string>();
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const guided = firstPortfolio && kind === "manual";

  useEffect(() => {
    if (open && step > 1) stepHeading.current?.focus();
  }, [open, step]);

  function goToStep(next: number) {
    setError("");
    setStep(next);
  }

  return (
    <>
      <button
        onClick={() => {
          setStep(1);
          setKind("manual");
          setName("");
          setCapital("");
          setError("");
          setRequestId(undefined);
          setOpen(true);
        }}
        className={
          compact
            ? "btn btn-ghost min-h-11 w-full justify-start gap-3 text-xs"
            : "btn btn-primary min-h-11 motion-safe:transition-transform motion-safe:active:scale-[0.98]"
        }
      >
        <Plus size={16} aria-hidden="true" />
        პორტფელის შექმნა
      </button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="ახალი პორტფელი"
        description={
          step === 1
            ? "დაარქვით სახელი პორტფელს და აირჩიეთ, როგორ გსურთ მისი მართვა."
            : ""
        }
        closeDisabled={pending}
      >
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (pending) return;
            const data = new FormData(e.currentTarget);
            if (guided && step === 1) {
              const result = portfolioSchema.safeParse({ name });
              if (!result.success) {
                setError(result.error.issues[0].message);
                return;
              }
              setName(result.data.name);
              goToStep(2);
              return;
            }
            if (guided && step === 2) {
              const result = positiveAmount.safeParse(capital);
              if (!result.success) {
                setError(result.error.issues[0].message);
                return;
              }
              setCapital(result.data);
              goToStep(3);
              return;
            }
            const id = requestId ?? crypto.randomUUID();
            setRequestId(id);
            setPending(true);
            setError("");
            try {
              const result =
                kind === "manual"
                  ? await createPortfolio({
                      name,
                      requestId: id,
                      initialCapital: guided && capital ? capital : undefined,
                    })
                  : await createWalletPortfolio({
                      name,
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
          {guided && (
            <div className="space-y-2">
              <p className="text-xs text-base-content/75">ნაბიჯი {step} / 3</p>
              <progress
                className="progress progress-primary w-full"
                aria-label="პორტფელის დაყენების პროგრესი"
                value={step}
                max={3}
              />
            </div>
          )}
          {step === 1 ? (
            <div className="space-y-4 rounded-xl border border-base-content/10 bg-base-200/50 p-4">
              <Field label="პორტფელის სახელი">
                <input
                  className="input"
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={60}
                  placeholder="მაგ. გრძელვადიანი პორტფელი"
                  disabled={pending}
                  autoFocus
                />
              </Field>
              <Field label="პორტფელის ტიპი">
                <select
                  className="select w-full"
                  value={kind}
                  onChange={(e) => {
                    setKind(e.target.value);
                    setError("");
                  }}
                  disabled={pending}
                >
                  <option value="manual">ხელით მართული</option>
                  <option value="stellar">Stellar · Read-only</option>
                  <option value="bitcoin">Bitcoin · Read-only</option>
                </select>
              </Field>
              {kind !== "manual" && (
                <div className="portfolio-create-reveal">
                  <Field label="საჯარო მისამართები">
                    <textarea
                      className="textarea w-full font-mono text-xs"
                      name="addresses"
                      required
                      disabled={pending}
                      rows={3}
                      maxLength={1000}
                      placeholder={
                        kind === "stellar"
                          ? "G…\nთითო მისამართი ახალ ხაზზე"
                          : "bc1… / 1… / 3…\nთითო მისამართი ახალ ხაზზე"
                      }
                    />
                  </Field>
                </div>
              )}
              <p className="text-xs leading-relaxed text-base-content/75">
                {kind === "manual"
                  ? "საანგარიშო ვალუტა: USD"
                  : `მხოლოდ Mainnet · მაქსიმუმ 10 მისამართი. გასაღები და ხელმოწერა არ გვჭირდება. მისამართები გადაეცემა ${kind === "stellar" ? "Stellar Horizon-ს" : "mempool.space-ს"}.`}
              </p>
            </div>
          ) : (
            <div key={step} className="portfolio-create-reveal space-y-3 rounded-xl border border-base-content/10 bg-base-200/50 p-4">
              <h3 ref={stepHeading} tabIndex={-1} className="font-semibold">
                {step === 2 ? "საწყისი კაპიტალი" : "გადახედეთ მონაცემებს"}
              </h3>
              {step === 2 ? (
                <>
                  <p className="text-sm text-base-content/75">
                    თანხა ჩაიწერება პორტფელში პირველ USD შენატანად.
                  </p>
                  <Field label="თანხა (USD)">
                    <input
                      inputMode="decimal"
                      value={capital}
                      onChange={(e) => setCapital(e.target.value)}
                      placeholder="0.00"
                      maxLength={60}
                    />
                  </Field>
                </>
              ) : (
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="shrink-0 text-base-content/75">სახელი</dt>
                    <dd className="min-w-0 break-words text-right font-medium">{name}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-base-content/75">საწყისი კაპიტალი</dt>
                    <dd className="min-w-0 break-words text-right font-medium">
                      {capital ? `${capital} USD` : "გამოტოვებულია"}
                    </dd>
                  </div>
                </dl>
              )}
            </div>
          )}
          {error && <Message error>{error}</Message>}
          {step > 1 && (
            <div className="flex flex-wrap justify-between gap-2">
              <button type="button" className="btn btn-ghost min-h-11" disabled={pending} onClick={() => goToStep(step - 1)}>
                უკან
              </button>
              {step === 2 && (
                <button type="button" className="btn btn-ghost min-h-11" onClick={() => {
                  setCapital("");
                  goToStep(3);
                }}>
                  გამოტოვება
                </button>
              )}
            </div>
          )}
          <button
            disabled={pending}
            aria-busy={pending}
            className="btn btn-primary min-h-12 w-full motion-safe:transition-transform motion-safe:active:scale-[0.98]"
          >
            {pending ? (
              <span
                className="loading loading-spinner loading-xs"
                aria-hidden="true"
              />
            ) : (
              <ArrowRight size={16} aria-hidden="true" />
            )}
            <span role="status">
              {pending
                ? "იქმნება პორტფელი…"
                : guided && step < 3
                  ? "გაგრძელება"
                  : "პორტფელის შექმნა"}
            </span>
          </button>
        </form>
      </Modal>
    </>
  );
}
