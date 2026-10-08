"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Search, Trash2 } from "lucide-react";
import type { Asset } from "@/domain/types";
import { transactionSchema } from "@/domain/validation";
import { searchAssets } from "@/server/actions";
import { saveOpeningAssets } from "@/server/transaction-features";
import { Field, Message, Modal } from "./ui";
import { TransactionForm } from "./transaction-form";
import { ImpactPreview } from "./transaction-impact";
import { useBalancesHidden } from "./balance-privacy";
type Row = { id: string; assetId: string; quantity: string; price: string };
export function OpeningAssets({
  portfolioId,
  revision,
  assets,
}: {
  portfolioId: string;
  revision: number;
  assets: Asset[];
}) {
  const [open, setOpen] = useState(false),
    [rows, setRows] = useState<Row[]>([]),
    [options, setOptions] = useState(assets);
  const [date, setDate] = useState(""),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [searching, setSearching] = useState(false),
    [ready, setReady] = useState(false);
  const hidden = useBalancesHidden(),
    router = useRouter();
  const menu = useRef<HTMLDetailsElement>(null);
  const addRow = () =>
    setRows((old) => [
      ...old,
      {
        id: crypto.randomUUID(),
        assetId:
          options.find(
            (a) => a.id !== "USD" && !old.some((r) => r.assetId === a.id),
          )?.id ?? "",
        quantity: "",
        price: "",
      },
    ]);
  const parsed = rows.map((row) =>
    transactionSchema.safeParse({
      ...row,
      portfolioId,
      kind: "deposit",
      price: row.price.trim() || null,
      fee: "0",
      occurredAt:
        date && !Number.isNaN(Date.parse(date))
          ? new Date(date).toISOString()
          : "",
      notes: "",
      airdropSource: "",
      airdropNetwork: "",
      airdropStatus: null,
    }),
  );
  const duplicate =
    new Set(rows.map((row) => row.assetId)).size !== rows.length;
  const input =
    !duplicate && parsed.length > 0 && parsed.every((p) => p.success)
      ? parsed.map((p) => p.data!)
      : null;
  const changeRow = (id: string, field: keyof Row, value: string) => {
    setReady(false);
    setRows((old) =>
      old.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );
  };
  return (
    <>
      <div className="join flex">
        <TransactionForm
          portfolioId={portfolioId}
          revision={revision}
          assets={assets}
          opening
          triggerClassName="join-item"
        />
        <details
          ref={menu}
          className="dropdown dropdown-end"
          onKeyDown={(event) => {
            if (event.key === "Escape" && menu.current)
              menu.current.open = false;
          }}
        >
          <summary
            role="button"
            className="btn btn-primary btn-square join-item"
            aria-label="დამატების ვარიანტები"
          >
            <ChevronDown size={16} />
          </summary>
          <ul className="menu dropdown-content z-30 mt-2 w-64 rounded-box border border-base-300 bg-base-300 p-2 shadow-lg">
            <li>
              <button
                className="min-h-11"
                aria-label="რამდენიმე აქტივის დამატება"
                onClick={() => {
                  if (menu.current) menu.current.open = false;
                  menu.current?.querySelector("summary")?.focus();
                  const now = new Date();
                  setDate(
                    new Date(now.getTime() - now.getTimezoneOffset() * 60000)
                      .toISOString()
                      .slice(0, 16),
                  );
                  setRows([
                    {
                      id: crypto.randomUUID(),
                      assetId: options.find((a) => a.id !== "USD")?.id ?? "",
                      quantity: "",
                      price: "",
                    },
                  ]);
                  setError("");
                  setReady(false);
                  setOpen(true);
                }}
              >
                <Plus size={18} /> რამდენიმე არსებული აქტივი
              </button>
            </li>
          </ul>
        </details>
      </div>
      <Modal
        title="არსებული აქტივების დამატება"
        description="USD არ შემცირდება. უცნობი თვითღირებულება დატოვეთ ცარიელი."
        open={open}
        closeDisabled={pending}
        onOpenChange={(value) => {
          if (!pending) setOpen(value);
        }}
        className="flex flex-col overflow-hidden!"
        contentClassName="flex min-h-0 flex-1 flex-col"
      >
        <form
          className="flex min-h-0 flex-col"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!input || !ready || pending) return;
            setPending(true);
            setError("");
            try {
              const reply = await saveOpeningAssets(input, revision);
              if (reply.ok) {
                setOpen(false);
                router.refresh();
              } else setError(reply.error);
            } catch {
              setError("შენახვა ვერ მოხერხდა. მონაცემები შენარჩუნებულია.");
            } finally {
              setPending(false);
            }
          }}
        >
          <div
            data-dialog-scroll
            className="min-h-0 space-y-3 overflow-y-auto overscroll-contain pr-1"
          >
            <Field label="საერთო თარიღი">
              <input
                className="input"
                type="datetime-local"
                required
                value={date}
                onChange={(e) => {
                  setReady(false);
                  setDate(e.target.value);
                }}
              />
            </Field>
            <div className="join flex">
              <input
                className="input join-item min-w-0 flex-1"
                aria-label="აქტივის ძიება"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="სხვა აქტივის ძიება"
              />
              <button
                type="button"
                aria-label="ძიება"
                className="btn join-item"
                disabled={searching || query.trim().length < 2}
                onClick={async () => {
                  setSearching(true);
                  try {
                    const reply = await searchAssets(query);
                    if (reply.ok) {
                      setOptions((old) => [
                        ...old,
                        ...reply.assets.filter(
                          (a) => !old.some((o) => o.id === a.id),
                        ),
                      ]);
                      if (!reply.assets.length)
                        setError("აქტივი ვერ მოიძებნა.");
                    } else setError(reply.error);
                  } catch {
                    setError("ძიება ვერ მოხერხდა.");
                  } finally {
                    setSearching(false);
                  }
                }}
              >
                <Search size={16} />
              </button>
            </div>
            {rows.map((row, index) => (
              <fieldset
                key={row.id}
                className="fieldset rounded-box border border-base-300 p-3"
              >
                <legend className="fieldset-legend">აქტივი {index + 1}</legend>
                <div className="flex gap-2">
                  <select
                    aria-label={`აქტივი ${index + 1}`}
                    className="select min-w-0 flex-1"
                    value={row.assetId}
                    onChange={(e) =>
                      changeRow(row.id, "assetId", e.target.value)
                    }
                  >
                    {options
                      .filter((a) => a.id !== "USD")
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.symbol} · {a.name}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-ghost btn-square"
                    aria-label={`რიგი ${index + 1} წაშლა`}
                    disabled={rows.length === 1 || pending}
                    onClick={() => {
                      setReady(false);
                      setRows((old) => old.filter((r) => r.id !== row.id));
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="რაოდენობა">
                    <input
                      className="input"
                      type={hidden ? "password" : "text"}
                      inputMode="decimal"
                      required
                      value={row.quantity}
                      onChange={(e) =>
                        changeRow(row.id, "quantity", e.target.value)
                      }
                    />
                  </Field>
                  <Field label="საშუალო ფასი (არასავალდებულო)">
                    <input
                      className="input"
                      type={hidden ? "password" : "text"}
                      inputMode="decimal"
                      value={row.price}
                      onChange={(e) =>
                        changeRow(row.id, "price", e.target.value)
                      }
                      placeholder="უცნობია"
                    />
                  </Field>
                </div>
              </fieldset>
            ))}
            <button
              type="button"
              className="btn btn-dash w-full"
              disabled={rows.length >= 20 || pending}
              onClick={() => {
                setReady(false);
                addRow();
              }}
            >
              <Plus size={16} /> რიგის დამატება · {rows.length}/20
            </button>
            {duplicate && (
              <Message error>ერთი აქტივი მხოლოდ ერთხელ აირჩიეთ.</Message>
            )}
            <ImpactPreview
              portfolioId={portfolioId}
              revision={revision}
              operation="batch"
              input={open ? input : null}
              onReady={setReady}
            />
            {error && <Message error>{error}</Message>}
          </div>
          <div className="modal-action shrink-0 border-t border-base-300 pt-3">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              გაუქმება
            </button>
            <button
              className="btn btn-primary"
              disabled={pending || !ready || !input}
            >
              {pending ? "ინახება…" : "ყველას შენახვა"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
