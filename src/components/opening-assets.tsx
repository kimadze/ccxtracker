"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import type { Asset } from "@/domain/types";
import { transactionSchema } from "@/domain/validation";
import { AssetPicker } from "./asset-picker";
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
  preferredAssetIds = [],
}: {
  portfolioId: string;
  revision: number;
  assets: Asset[];
  preferredAssetIds?: string[];
}) {
  const [open, setOpen] = useState(false),
    [rows, setRows] = useState<Row[]>([]),
    [options, setOptions] = useState(assets);
  const [date, setDate] = useState(""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [ready, setReady] = useState(false);
  const hidden = useBalancesHidden(),
    router = useRouter();
  const menu = useRef<HTMLDetailsElement>(null);
  const addRow = () =>
    setRows((old) => [
      ...old,
      {
        id: crypto.randomUUID(),
        assetId: "",
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
  const chosenIds = rows.map((row) => row.assetId).filter(Boolean);
  const duplicate = new Set(chosenIds).size !== chosenIds.length;
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
          preferredAssetIds={preferredAssetIds}
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
                      assetId: "",
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
            {rows.map((row, index) => (
              <fieldset
                key={row.id}
                className="fieldset rounded-box border border-base-300 p-3"
              >
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1">
                    <AssetPicker
                      label={`აქტივი ${index + 1}`}
                      assets={options.filter((asset) => asset.id !== "USD")}
                      value={row.assetId}
                      preferredIds={preferredAssetIds}
                      disabled={pending}
                      onChange={(id) => changeRow(row.id, "assetId", id)}
                      onDiscover={(found) =>
                        setOptions((current) => [
                          ...current,
                          ...found.filter(
                            (asset) =>
                              !current.some((item) => item.id === asset.id),
                          ),
                        ])
                      }
                    />
                  </div>
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
