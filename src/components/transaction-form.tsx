"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus } from "lucide-react";
import type { Asset, LedgerEntry, TransactionKind } from "@/domain/types";
import { saveTransaction, searchAssets } from "@/server/actions";
import { Field, Message, Modal } from "./ui";

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
        className={
          entry ? "btn btn-ghost btn-xs" : "btn btn-primary"
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
        description={
          opening
            ? "არსებული აქტივის შესატანად მიუთითეთ რაოდენობა და საშუალო თვითღირებულება. ახალი შესყიდვისთვის აირჩიეთ შესყიდვა."
            : "ტრანზაქცია განაახლებს პორტფელსა და მასთან დაკავშირებულ გამოთვლებს."
        }
        wide
      >
        <form
          className="space-y-5"
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
          <fieldset className="fieldset">
            <legend className="fieldset-legend">ტრანზაქციის ტიპი</legend>
            <div
              className="tabs tabs-box grid grid-cols-2 gap-1 sm:grid-cols-3"
              role="group"
              aria-label="ტრანზაქციის ტიპი"
            >
              {Object.entries(kindLabels).map(([value, label]) => (
                <button className={`tab h-auto min-h-11 whitespace-normal px-2 py-2 ${kind === value ? "tab-active" : ""}`}
                  key={value}
                  type="button"
                  aria-pressed={kind === value}
                  onClick={() => setKind(value as TransactionKind)}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="აქტივი">
              <select className="select select-bordered"
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
              >
                {options.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.symbol} · {a.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="join flex w-full">
            <input className="input join-item min-w-0 flex-1"
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
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={isCash ? "თანხა (USD)" : "რაოდენობა"}>
              <input className="input input-bordered"
                name="quantity"
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
                  <input className="input input-bordered"
                    name="price"
                    inputMode="decimal"
                    required={kind !== "deposit"}
                    defaultValue={entry?.price ?? draft?.price ?? ""}
                    placeholder={kind === "deposit" ? "თუ ცნობილია" : "0.00"}
                  />
                </Field>
              )}
            <Field label="საკომისიო (USD)">
              <input className="input input-bordered"
                name="fee"
                inputMode="decimal"
                defaultValue={entry?.fee ?? draft?.fee ?? "0"}
              />
            </Field>
            <Field label="თარიღი და დრო (თქვენი მოწყობილობის დრო)">
              <input className="input input-bordered"
                name="occurredAt"
                type="datetime-local"
                required
                defaultValue={defaultDate()}
              />
            </Field>
          </div>
          {kind === "buy" && (
            <div role="alert" className="alert alert-info alert-soft text-xs leading-6">
              შესყიდვა თანხის ნაშთიდან დაიფარება. საჭიროების შემთხვევაში ჯერ
              ჩაიწერეთ USD-ის შეტანა.
            </div>
          )}
          {kind === "deposit" && !isCash && (
            <div role="alert" className="alert alert-info alert-soft text-xs leading-6">
              თუ თვითღირებულება უცნობია, დატოვეთ ცარიელი. შესაბამისი მოგება /
              ზარალი არ გამოითვლება.
            </div>
          )}
          {kind === "airdrop" && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="პროექტი / წყარო">
                  <input className="input input-bordered"
                    name="airdropSource"
                    defaultValue={entry?.airdropSource ?? ""}
                    placeholder="მაგ. Jupiter"
                  />
                </Field>
                <Field label="ქსელი">
                  <input className="input input-bordered"
                    name="airdropNetwork"
                    defaultValue={entry?.airdropNetwork ?? ""}
                    placeholder="მაგ. Solana"
                  />
                </Field>
                <Field label="სტატუსი">
                  <select className="select select-bordered"
                    name="airdropStatus"
                    defaultValue={entry?.airdropStatus ?? "received"}
                  >
                    <option value="received">მიღებული</option>
                    <option value="locked">დაბლოკილი</option>
                  </select>
                </Field>
              </div>
              <div role="alert" className="alert alert-info alert-soft text-xs leading-6">
                Airdrop პორტფელში დაემატება თანხის ნაშთის შემცირების გარეშე.
                მიღების ფასი გახდება მისი საწყისი თვითღირებულება.
              </div>
            </>
          )}
          <Field label="შენიშვნა">
            <textarea className="textarea textarea-bordered"
              name="notes"
              rows={2}
              maxLength={2000}
              defaultValue={entry?.notes}
              placeholder="არასავალდებულო"
            />
          </Field>
          {entry && (
            <label className="label cursor-pointer items-start justify-start gap-3 text-xs leading-5">
              <input type="checkbox" required className="checkbox checkbox-primary mt-1" />
              ვადასტურებ ისტორიის შესწორებასა და შემდგომი ტრანზაქციების თავიდან
              გამოთვლას.
            </label>
          )}
          {error && <Message error>{error}</Message>}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="btn"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              გაუქმება
            </button>
            <button disabled={pending} className="btn btn-primary">
              {pending && <span className="loading loading-spinner loading-xs" />}
              {pending ? "ინახება…" : "შენახვა"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
