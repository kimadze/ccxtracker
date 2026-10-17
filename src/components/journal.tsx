"use client";
import { useState, useRef } from "react";
import { useUnsavedChanges } from "./unsaved-changes";
import { saveJournal } from "@/server/strategy-actions";
import { useRouter } from "next/navigation";
import { Field, Message } from "./ui";
export interface JournalData {
  updatedAt?: Date | string;
  thesis: string;
  entryReason: string;
  catalysts: string;
  invalidation: string;
  targets: string;
  conviction: "low" | "medium" | "high";
  horizon: string;
  notes: string;
}
export function JournalForm({
  portfolioId,
  assetId,
  initial,
  preview = false,
}: {
  portfolioId: string;
  assetId: string;
  initial?: JournalData | null;
  preview?: boolean;
}) {
  const [message, setMessage] = useState(""),
    [error, setError] = useState(false),
    [pending, setPending] = useState(false);
  const router = useRouter();
  const draft = useUnsavedChanges(!preview);
  const version = useRef(
    initial?.updatedAt ? new Date(initial.updatedAt).toISOString() : null,
  );
  return (
    <form
      className="grid w-full min-w-0 items-start gap-3 lg:grid-cols-2 lg:gap-4"
      onChangeCapture={draft.markDirty}
      onSubmit={async (e) => {
        e.preventDefault();
        if (preview) return;
        if (pending) return;
        const form = new FormData(e.currentTarget);
        const checkpoint = draft.checkpoint();
        setPending(true);
        try {
          const response = await saveJournal({
            portfolioId,
            assetId,
            expectedUpdatedAt: version.current,
            ...Object.fromEntries(form),
          });
          setError(!response.ok);
          setMessage(response.ok ? "ჟურნალი შენახულია." : response.error);
          if (response.ok) {
            version.current = response.updatedAt ?? null;
            draft.clear(checkpoint);
            router.refresh();
          }
        } catch {
          setError(true);
          setMessage("შენახვა ვერ მოხერხდა.");
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="min-w-0 space-y-3">
        <Field label="საინვესტიციო თეზისი">
          <textarea
            className="textarea"
            name="thesis"
            rows={4}
            maxLength={10000}
            defaultValue={initial?.thesis ?? ""}
            placeholder="რა არის მთავარი არგუმენტი ამ პოზიციისთვის?"
          />
        </Field>
        <Field label="დამატებითი შენიშვნები">
          <textarea
            className="textarea"
            name="notes"
            rows={4}
            maxLength={10000}
            defaultValue={initial?.notes ?? ""}
            placeholder="გადახედვის შედეგი, პირადი შენიშვნა ან ბმული…"
          />
        </Field>
      </div>
      <div className="min-w-0 space-y-3">
        <details className="collapse collapse-arrow border border-base-300 bg-base-200 ">
          <summary className="collapse-title min-h-11 text-sm font-semibold">
            შესვლა და მოლოდინი
          </summary>
          <div className="collapse-content">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="რატომ გავხსენი პოზიცია">
                <textarea
                  className="textarea"
                  name="entryReason"
                  rows={3}
                  maxLength={5000}
                  defaultValue={initial?.entryReason ?? ""}
                  placeholder="შესვლის მიზეზი…"
                />
              </Field>
              <Field label="კატალიზატორები">
                <textarea
                  className="textarea"
                  name="catalysts"
                  rows={3}
                  maxLength={5000}
                  defaultValue={initial?.catalysts ?? ""}
                  placeholder="რა უნდა მოხდეს, რომ თეზისი გამყარდეს?"
                />
              </Field>
              <Field label="თეზისის გაუქმების პირობები">
                <textarea
                  className="textarea"
                  name="invalidation"
                  rows={3}
                  maxLength={5000}
                  defaultValue={initial?.invalidation ?? ""}
                  placeholder="რომელი ფაქტი შეცვლის თქვენს ხედვას?"
                />
              </Field>
              <Field label="სამიზნე ფასები">
                <textarea
                  className="textarea"
                  name="targets"
                  rows={3}
                  maxLength={2000}
                  defaultValue={initial?.targets ?? ""}
                  placeholder="სამიზნეები და გასვლის პირობები…"
                />
              </Field>
            </div>
          </div>
        </details>
        <details className="collapse collapse-arrow border border-base-300 bg-base-200 ">
          <summary className="collapse-title min-h-11 text-sm font-semibold">
            რწმენა და დრო
          </summary>
          <div className="collapse-content">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="დარწმუნებულობის დონე">
                <select
                  className="select"
                  name="conviction"
                  defaultValue={initial?.conviction ?? "medium"}
                >
                  <option value="low">დაბალი</option>
                  <option value="medium">საშუალო</option>
                  <option value="high">მაღალი</option>
                </select>
              </Field>
              <Field label="საინვესტიციო ჰორიზონტი">
                <input
                  className="input"
                  name="horizon"
                  maxLength={200}
                  defaultValue={initial?.horizon ?? ""}
                  placeholder="მაგ. 2–3 წელი"
                />
              </Field>
            </div>
          </div>
        </details>
      </div>
      {message && <Message error={error}>{message}</Message>}
      {!preview && (
        <button
          className="btn btn-primary min-h-11 justify-self-start"
          disabled={pending}
          aria-busy={pending}
        >
          {pending && <span className="loading loading-spinner loading-xs" />}
          ჟურნალის შენახვა
        </button>
      )}
      {preview && (
        <p className="text-xs text-base-content/60">
          სადემონსტრაციო ჩანაწერი არ ინახება.
        </p>
      )}
    </form>
  );
}
