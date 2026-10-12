"use client";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import type { parseScreenshot } from "@/server/ai/screenshot";
import { confirmScreenshot } from "@/domain/ai-screenshot";

import { kindLabels } from "@/domain/transaction-labels";
import {
  prepareScreenshotUpload,
  SCREENSHOT_MAX_BYTES,
} from "@/lib/screenshot-upload";
import { Field, Message } from "./ui";

type Result = Extract<
  Awaited<ReturnType<typeof parseScreenshot>>,
  { ok: true }
>;
type ConfirmedResult = {
  ok: true;
  draft: ReturnType<typeof confirmScreenshot>;
  matches: Result["matches"];
};
export function AiScreenshotDraft({
  portfolioId,
  disabled,
  onResult,
  onReset,
  onBusy,
}: {
  portfolioId: string;
  disabled: boolean;
  onResult: (result: ConfirmedResult) => void;
  onReset: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [review, setReview] = useState<Result | null>(null);
  const [fields, setFields] = useState({
    kind: "",
    quantity: "",
    price: "",
    fee: "",
    day: "",
  });
  const [confirmed, setConfirmed] = useState(false);
  const [settlementRate, setSettlementRate] = useState("1");
  const input = useRef<HTMLInputElement>(null);
  const version = useRef(0);
  const previewUrl = useRef("");
  useEffect(
    () => () => {
      version.current++;
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    },
    [],
  );
  const reset = (clearInput = true) => {
    version.current++;
    setFile(null);
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = "";
    setPreview("");
    setError("");
    setReview(null);
    onReset();
    if (clearInput && input.current) input.current.value = "";
  };
  const selectImage = (chosen: File, pasted = false) => {
    if (disabled || pending) return;
    if (
      chosen.size > SCREENSHOT_MAX_BYTES ||
      !chosen.size ||
      !["image/png", "image/jpeg", "image/webp"].includes(chosen.type)
    ) {
      setError("აირჩიე PNG, JPEG ან WebP სურათი, მაქსიმუმ 5MB.");
      return;
    }
    reset(pasted);
    setFile(chosen);
    previewUrl.current = URL.createObjectURL(chosen);
    setPreview(previewUrl.current);
  };
  return (
    <section
      aria-label="სქრინშოტიდან შევსება"
      className="space-y-2 border-t border-base-300 pt-3"
    >
      <textarea
        aria-label="სურათის ჩასმის არე"
        placeholder="ჩასვი სურათი Ctrl+V-ით ან აირჩიე ფაილი"
        rows={2}
        value=""
        onChange={() => {}}
        className="textarea min-h-11 w-full resize-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        disabled={disabled || pending}
        onPaste={(event) => {
          event.preventDefault();
          const images = Array.from(event.clipboardData.items).filter(
            (item) => item.kind === "file",
          );
          if (!images.length) return;
          event.preventDefault();
          if (disabled || pending) return;
          if (images.length !== 1) {
            setError("ჩასვი მხოლოდ ერთი სურათი.");
            return;
          }
          const chosen = images[0].getAsFile();
          if (chosen) selectImage(chosen, true);
        }}
      />
      <Field label="სქრინშოტიდან შევსება">
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="file-input min-h-11 w-full min-w-0"
          disabled={disabled || pending}
          onChange={(e) => {
            const chosen = e.currentTarget.files?.[0];
            if (!chosen) return;
            selectImage(chosen);
          }}
        />
      </Field>
      <p className="text-xs text-base-content/60">
        PNG / JPEG / WebP · მაქს. 5MB. ამოკითხვისას სურათი გაიგზავნება
        OpenAI-ში; აპი მას არ შეინახავს. დაფარე პირადი მონაცემები.
      </p>
      {preview && (
        <div className="space-y-2">
          <div className="relative overflow-hidden rounded-box border border-base-300 bg-base-200">
            {/* Local object URL only; never uploaded to image optimization or Blob. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="არჩეული ტრანზაქციის სქრინშოტი"
              className="max-h-40 w-full object-contain"
            />
            <button
              type="button"
              aria-label="სურათის წაშლა"
              className="btn btn-square absolute right-1 top-1 min-h-11"
              disabled={pending}
              onClick={() => reset()}
            >
              <X size={18} />
            </button>
          </div>
          <button
            type="button"
            className="btn min-h-11"
            disabled={pending || disabled}
            onClick={async () => {
              if (!file || pending) return;
              const current = ++version.current;
              setPending(true);
              onBusy(true);
              setError("");
              setReview(null);
              setConfirmed(false);
              setSettlementRate("1");
              onReset();
              try {
                const upload = await prepareScreenshotUpload(file);
                const form = new FormData();
                form.set("image", upload);
                form.set("portfolioId", portfolioId);
                form.set(
                  "timezone",
                  Intl.DateTimeFormat().resolvedOptions().timeZone,
                );
                const response = await fetch("/api/ai/transaction-screenshot", {
                  method: "POST",
                  body: form,
                  signal: AbortSignal.timeout(30000),
                });
                const result = await response.json();
                if (current !== version.current) return;
                if (response.ok && result.ok) {
                  const reply = result as Result;
                  const value = reply.extraction;
                  setReview(reply);
                  setFields({
                    kind: value.kind ?? "",
                    quantity: value.quantity ?? "",
                    price: ["USD", "USDT", "USDC"].includes(
                      value.currency ?? "",
                    )
                      ? (value.price ?? "")
                      : "",
                    fee:
                      value.feeCurrency &&
                      value.feeCurrency === value.currency &&
                      ["USD", "USDT", "USDC"].includes(value.currency ?? "")
                        ? (value.fee ?? "")
                        : "",
                    day: value.day ?? "",
                  });
                } else
                  setError(
                    typeof result.error === "string"
                      ? result.error
                      : "სურათი ვერ გაიშიფრა.",
                  );
              } catch (failure) {
                if (current === version.current)
                  setError(
                    failure instanceof Error &&
                      failure.message.includes("სურათი")
                      ? failure.message
                      : "ამოკითხვა ვერ შესრულდა. სცადე ხელახლა ან შეავსე ფორმა ხელით.",
                  );
              } finally {
                if (current === version.current) setPending(false);
                onBusy(false);
              }
            }}
          >
            {pending ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <ImagePlus size={16} />
            )}{" "}
            ამოკითხვა
          </button>
        </div>
      )}
      {review && (
        <div className="space-y-2 border-t border-base-300 pt-3">
          <p className="text-sm font-medium">
            {review.extraction.symbol} · {review.extraction.status} ·{" "}
            {review.extraction.currency ?? "ვალუტა უცნობია"}
          </p>
          {review.extraction.partial && (
            <Message>
              მხოლოდ შესრულებული ნაწილი — ორდერის სრული რაოდენობა არ დაემატება.
            </Message>
          )}
          {review.extraction.dateText && (
            <p className="text-xs text-base-content/60">
              სურათის თარიღი: {review.extraction.dateText}. წელი და დროის
              სარტყელი გადაამოწმე.
            </p>
          )}
          {review.extraction.issues.map((issue, index) => (
            <p key={index} className="text-xs text-warning">
              {issue}
            </p>
          ))}
          {!["USD", "USDT", "USDC"].includes(
            review.extraction.currency ?? "",
          ) && (
            <Message>
              ვალუტა USD არ არის ან უცნობია. ფასი ხელით მიუთითე USD-ში.
            </Message>
          )}
          <Field label="ამოკითხული მოქმედება">
            <select
              className="select min-h-11 w-full"
              value={fields.kind}
              onChange={(e) => {
                setConfirmed(false);
                onReset();
                setFields({ ...fields, kind: e.target.value });
              }}
            >
              <option value="">აირჩიე მოქმედება</option>
              {Object.entries(kindLabels).map(([kind, label]) => (
                <option key={kind} value={kind}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(
              [
                ["quantity", "შესრულებული რაოდენობა"],
                ["price", "შესრულების ფასი"],
                ["fee", "საკომისიო — სურვილისამებრ"],
                ["day", "ტრანზაქციის თარიღი (შენი დროით)"],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <input
                  className="input min-h-11 w-full min-w-0"
                  type={key === "day" ? "date" : "text"}
                  inputMode={key === "day" ? undefined : "decimal"}
                  placeholder={key === "fee" ? "ცარიელი = 0" : undefined}
                  value={fields[key]}
                  onChange={(e) => {
                    setConfirmed(false);
                    onReset();
                    setFields({ ...fields, [key]: e.target.value });
                  }}
                />
              </Field>
            ))}
          </div>
          {["USDT", "USDC"].includes(review.extraction.currency ?? "") && (
            <Field label={`1 ${review.extraction.currency} = USD`}>
              <input
                className="input min-h-11 w-full"
                inputMode="decimal"
                value={settlementRate}
                onChange={(e) => {
                  setSettlementRate(e.target.value);
                  setConfirmed(false);
                  onReset();
                }}
              />
            </Field>
          )}
          <label className="flex min-h-11 items-center gap-2 text-xs">
            <input
              type="checkbox"
              className="checkbox"
              checked={confirmed}
              onChange={(e) => {
                onReset();
                setConfirmed(e.target.checked);
              }}
            />
            გადავამოწმე შესრულებული რაოდენობა, ფასი, საკომისიო და თარიღი
          </label>
          <button
            type="button"
            className="btn min-h-11"
            disabled={
              disabled ||
              pending ||
              !confirmed ||
              (["USDT", "USDC"].includes(review.extraction.currency ?? "") &&
                !settlementRate)
            }
            onClick={() => {
              try {
                const draft = confirmScreenshot(
                  review.extraction,
                  fields,
                  confirmed,
                  settlementRate,
                );
                setError("");
                onResult({ ok: true, draft, matches: review.matches });
              } catch (failure) {
                setError(
                  failure instanceof Error
                    ? failure.message
                    : "დააზუსტე მონაცემები.",
                );
              }
            }}
          >
            მონახაზის დადასტურება
          </button>
        </div>
      )}
      {error && <Message error>{error}</Message>}
    </section>
  );
}
