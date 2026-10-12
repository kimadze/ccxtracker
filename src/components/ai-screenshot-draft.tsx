"use client";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import type { parseScreenshot } from "@/server/ai/screenshot";
import {
  prepareScreenshotUpload,
  SCREENSHOT_MAX_BYTES,
} from "@/lib/screenshot-upload";
import { Field, Message } from "./ui";

type Result = Extract<
  Awaited<ReturnType<typeof parseScreenshot>>,
  { ok: true }
>;
export function AiScreenshotDraft({
  portfolioId,
  disabled,
  onResult,
  onReset,
  onBusy,
}: {
  portfolioId: string;
  disabled: boolean;
  onResult: (result: Result) => void;
  onReset: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
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
    onReset();
    if (clearInput && input.current) input.current.value = "";
  };
  return (
    <section
      aria-label="სქრინშოტიდან შევსება"
      className="space-y-2 border-t border-base-300 pt-3"
    >
      <Field label="სქრინშოტიდან შევსება">
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="file-input min-h-11 w-full min-w-0"
          disabled={disabled || pending}
          onChange={(e) => {
            const chosen = e.currentTarget.files?.[0];
            reset(false);
            if (!chosen) return;
            if (
              chosen.size > SCREENSHOT_MAX_BYTES ||
              !chosen.size ||
              !["image/png", "image/jpeg", "image/webp"].includes(chosen.type)
            ) {
              setError("აირჩიე PNG, JPEG ან WebP სურათი, მაქსიმუმ 5MB.");
              return;
            }
            setFile(chosen);
            previewUrl.current = URL.createObjectURL(chosen);
            setPreview(previewUrl.current);
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
                if (response.ok && result.ok) onResult(result as Result);
                else
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
      {error && <Message error>{error}</Message>}
    </section>
  );
}
