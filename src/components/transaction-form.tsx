"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus } from "lucide-react";
import type { Asset, LedgerEntry, TransactionKind } from "@/domain/types";
import { saveTransaction, searchAssets } from "@/server/actions";
import { Field, Message, Modal } from "./ui";
import { useBalancesHidden } from "./balance-privacy";

export const kindLabels: Record<TransactionKind, string> = {
  buy: "შესყიდვა",
  sell: "გაყიდვა",
  deposit: "შეტანა",
  withdrawal: "გატანა",
  fee: "საკომისიო",
  airdrop: "Airdrop მიღება",
};
export function TransactionForm({
  portfolioId,
  revision,
  assets,
  entry,
  initialAsset,
  opening = false,
  draft,
  triggerLabel,
  triggerClassName,
  initialKind,
  defaultOpen = false,
}: {
  portfolioId: string;
  revision: number;
  assets: Asset[];
  entry?: LedgerEntry;
  initialAsset?: string;
  opening?: boolean;
  draft?: { quantity: string; price: string; fee: string };
  triggerLabel?: string;
  triggerClassName?: string;
  initialKind?: TransactionKind;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen && !entry),
    [kind, setKind] = useState<TransactionKind>(
      entry?.kind ?? initialKind ?? (opening ? "deposit" : "buy"),
    ),
    [assetId, setAssetId] = useState(
      entry?.assetId ?? initialAsset ?? (opening ? "bitcoin" : "bitcoin"),
    );
  const [options, setOptions] = useState(assets),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [searching, setSearching] = useState(false);
  const [currentRevision, setCurrentRevision] = useState(revision);
  const [submissionId, setSubmissionId] = useState(
    () => entry?.id ?? (defaultOpen ? crypto.randomUUID() : ""),
  );
  const router = useRouter();
  const balancesHidden = useBalancesHidden();
  const isCash = assetId === "USD";
  const defaultDate = () => {
    const d = entry ? new Date(entry.occurredAt) : new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };
  return (
    <>
      <button
        className={`${entry ? "btn btn-ghost btn-xs" : "btn btn-primary"} ${triggerClassName ?? ""}`}
        aria-label={
          triggerLabel
            ? entry
              ? "ტრანზაქციის რედაქტირება"
              : "ტრანზაქციის დამატება"
            : undefined
        }
        onClick={() => {
          setSubmissionId(entry?.id ?? crypto.randomUUID());
          setError("");
          setOpen(true);
        }}
      >
        {!entry && <Plus size={16} />}
        {triggerLabel ??
          (entry
            ? "რედაქტირება"
            : opening
              ? "პოზიციის დამატება"
              : "ტრანზაქციის დამატება")}
      </button>
      <Modal
        open={open}
        onOpenChange={(value) => {
          if (!pending) setOpen(value);
        }}
        title={
          entry
            ? "ტრანზაქციის რედაქტირება"
            : opening
              ? "პოზიციის დამატება"
              : "ტრანზაქციის დამატება"
        }
        description=""
        className="flex flex-col overflow-hidden!"
        contentClassName="flex min-h-0 flex-1 flex-col"
      >
        <form
          className="flex min-h-0 flex-col"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            setPending(true);
            setError("");
            const rawPrice = String(form.get("price") ?? "").trim();
            try {
              const result = await saveTransaction(
                {
                  id: submissionId,
                  portfolioId,
                  assetId,
                  kind,
                  quantity: String(form.get("quantity")),
                  price: rawPrice || null,
                  fee: String(form.get("fee") || "0"),
                  occurredAt: new Date(
                    String(form.get("occurredAt")),
                  ).toISOString(),
                  notes: String(form.get("notes") ?? ""),
                  airdropSource:
                    kind === "airdrop"
                      ? String(form.get("airdropSource") ?? "")
                      : "",
                  airdropNetwork:
                    kind === "airdrop"
                      ? String(form.get("airdropNetwork") ?? "")
                      : "",
                  airdropStatus:
                    kind === "airdrop"
                      ? String(form.get("airdropStatus") ?? "received")
                      : null,
                },
                entry ? "update" : "create",
                Math.max(revision, currentRevision),
              );
              if (result.ok) {
                if (result.revision !== undefined)
                  setCurrentRevision(result.revision);
                setOpen(false);
                router.refresh();
              } else setError(result.error);
            } catch {
              setError(
                "მოქმედება ვერ შესრულდა. გადაამოწმეთ მონაცემები და სცადეთ ხელახლა.",
              );
            } finally {
              setPending(false);
            }
          }}
        >
          <div
            data-dialog-scroll
            className="min-h-0 overflow-y-auto overscroll-contain space-y-2 pr-1"
          >
            <Field label="ტრანზაქციის ტიპი">
              <select
                value={
                  kind === "deposit"
                    ? isCash
                      ? "cash-deposit"
                      : "asset-deposit"
                    : kind
                }
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "cash-deposit") {
                    setKind("deposit");
                    setAssetId("USD");
                  } else if (value === "asset-deposit") {
                    setKind("deposit");
                    if (isCash)
                      setAssetId(
                        options.find((a) => a.id !== "USD")?.id ?? "bitcoin",
                      );
                  } else {
                    setKind(value as TransactionKind);
                    if (isCash && ["buy", "sell", "airdrop"].includes(value))
                      setAssetId(
                        options.find((a) => a.id !== "USD")?.id ?? "bitcoin",
                      );
                  }
                }}
              >
                <option value="buy">შესყიდვა</option>
                <option value="sell">გაყიდვა</option>
                <option value="asset-deposit">არსებული აქტივის დამატება</option>
                <option value="cash-deposit">ფულის შეტანა</option>
                <option value="withdrawal">გატანა</option>
                <option value="fee">საკომისიო</option>
                <option value="airdrop">Airdrop მიღება</option>
              </select>
            </Field>
            <div>
              <Field label="აქტივი">
                <select
                  className="select"
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
                >
                  {options
                    .filter((a) =>
                      kind === "deposit"
                        ? isCash
                          ? a.id === "USD"
                          : a.id !== "USD"
                        : ["buy", "sell", "airdrop"].includes(kind)
                          ? a.id !== "USD"
                          : true,
                    )
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.symbol} · {a.name}
                      </option>
                    ))}
                </select>
              </Field>
            </div>
            {!(kind === "deposit" && isCash) && (
              <details className="collapse collapse-arrow bg-base-100">
                <summary className="collapse-title min-h-11 py-3 text-xs">
                  სხვა აქტივის ძიება
                </summary>
                <div className="collapse-content">
                  <div className="join flex w-full">
                    <input
                      className="input join-item min-w-0 flex-1"
                      aria-label="სხვა აქტივის ძიება"
                      placeholder="სხვა აქტივის ძიება…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn join-item shrink-0"
                      disabled={searching || query.trim().length < 2}
                      onClick={async () => {
                        setSearching(true);
                        try {
                          const result = await searchAssets(query);
                          if (result.ok) {
                            setOptions((current) => [
                              ...current,
                              ...result.assets.filter(
                                (a) => !current.some((c) => c.id === a.id),
                              ),
                            ]);
                            if (result.assets[0]) {
                              setAssetId(result.assets[0].id);
                              setQuery("");
                            } else setError("აქტივი ვერ მოიძებნა.");
                          } else setError(result.error);
                        } catch {
                          setError("ძიება ვერ მოხერხდა.");
                        } finally {
                          setSearching(false);
                        }
                      }}
                    >
                      <Search size={15} />
                      {searching ? "ძიება…" : "ძიება"}
                    </button>
                  </div>
                </div>
              </details>
            )}
            <div className="grid gap-x-3 gap-y-1 sm:grid-cols-2">
              <Field label={isCash ? "თანხა (USD)" : "რაოდენობა"}>
                <input
                  className="input"
                  name="quantity"
                  type={balancesHidden ? "password" : "text"}
                  inputMode="decimal"
                  required
                  defaultValue={entry?.quantity ?? draft?.quantity}
                  placeholder="0.00"
                />
              </Field>
              {!isCash &&
                (kind === "buy" ||
                  kind === "sell" ||
                  kind === "deposit" ||
                  kind === "airdrop") && (
                  <Field
                    label={
                      kind === "deposit"
                        ? "საშუალო თვითღირებულება (USD)"
                        : kind === "airdrop"
                          ? "მიღების მომენტში ფასი (USD)"
                          : "ერთეულის ფასი (USD)"
                    }
                  >
                    <input
                      className="input"
                      name="price"
                      type={balancesHidden ? "password" : "text"}
                      inputMode="decimal"
                      required={kind !== "deposit"}
                      defaultValue={entry?.price ?? draft?.price ?? ""}
                      placeholder={kind === "deposit" ? "თუ ცნობილია" : "0.00"}
                    />
                  </Field>
                )}
              <Field label="თარიღი და დრო">
                <input
                  className="input"
                  name="occurredAt"
                  type="datetime-local"
                  required
                  defaultValue={defaultDate()}
                />
              </Field>
            </div>
            {kind === "buy" && (
              <div
                role="alert"
                className="text-xs leading-5 text-base-content/60"
              >
                შესყიდვა USD-ის ნაშთს შეამცირებს.
              </div>
            )}
            {kind === "deposit" && !isCash && (
              <div
                role="alert"
                className="text-xs leading-5 text-base-content/60"
              >
                USD-ის ნაშთი არ შემცირდება. თუ თვითღირებულება უცნობია, დატოვეთ
                ცარიელი — შესაბამისი P/L იქნება „—“.
              </div>
            )}
            {kind === "airdrop" && (
              <>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Field label="პროექტი / წყარო">
                    <input
                      className="input"
                      name="airdropSource"
                      defaultValue={entry?.airdropSource ?? ""}
                      placeholder="მაგ. Jupiter"
                    />
                  </Field>
                  <Field label="ქსელი">
                    <input
                      className="input"
                      name="airdropNetwork"
                      defaultValue={entry?.airdropNetwork ?? ""}
                      placeholder="მაგ. Solana"
                    />
                  </Field>
                  <Field label="სტატუსი">
                    <select
                      className="select"
                      name="airdropStatus"
                      defaultValue={entry?.airdropStatus ?? "received"}
                    >
                      <option value="received">მიღებული</option>
                      <option value="locked">დაბლოკილი</option>
                    </select>
                  </Field>
                </div>
                <div
                  role="alert"
                  className="text-xs leading-5 text-base-content/60"
                >
                  მიღების ფასი განსაზღვრავს თვითღირებულებას; USD-ის ნაშთი მხოლოდ
                  საკომისიოთი შემცირდება.
                </div>
              </>
            )}
            <details
              open={
                !!entry?.notes ||
                (!!entry?.fee && entry.fee !== "0") ||
                (!!draft?.fee && draft.fee !== "0")
              }
              className="collapse collapse-arrow bg-base-100"
            >
              <summary className="collapse-title min-h-11 text-sm">
                საკომისიო და შენიშვნა
              </summary>
              <div className="collapse-content">
                <Field label="საკომისიო (USD)">
                  <input
                    className="input"
                    name="fee"
                    type={balancesHidden ? "password" : "text"}
                    inputMode="decimal"
                    defaultValue={entry?.fee ?? draft?.fee ?? "0"}
                  />
                </Field>
                <Field label="შენიშვნა">
                  <textarea
                    className="textarea"
                    name="notes"
                    rows={2}
                    maxLength={2000}
                    defaultValue={entry?.notes}
                    placeholder="არასავალდებულო"
                  />
                </Field>
              </div>
            </details>
            {entry && (
              <label className="label cursor-pointer items-start justify-start gap-3 text-xs leading-5">
                <input
                  type="checkbox"
                  required
                  className="checkbox checkbox-primary mt-1"
                />
                ვადასტურებ ისტორიის შესწორებასა და შემდგომი ტრანზაქციების
                თავიდან გამოთვლას.
              </label>
            )}
          </div>
          {error && (
            <div className="mt-2 shrink-0">
              <Message error>{error}</Message>
            </div>
          )}
          <div className="modal-action mt-3 shrink-0 justify-end gap-2 border-t border-base-200 bg-base-300 pt-3">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              გაუქმება
            </button>
            <button
              disabled={pending}
              aria-busy={pending}
              className="btn btn-primary min-w-28"
            >
              {pending && (
                <span className="loading loading-spinner loading-xs" />
              )}
              შენახვა
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
