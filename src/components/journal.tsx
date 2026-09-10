"use client";
import { useState } from "react";
import { saveJournal } from "@/server/strategy-actions";
import { useRouter } from "next/navigation";
import { Field, Message } from "./ui";
export interface JournalData {
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
  return (
    <form
      className="panel space-y-6 p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        if (preview) return;
        const form = new FormData(e.currentTarget);
        setPending(true);
        try {
          const response = await saveJournal({
            portfolioId,
            assetId,
            ...Object.fromEntries(form),
          });
          setError(!response.ok);
          setMessage(response.ok ? "ჟურნალი შენახულია." : response.error);
          if (response.ok) router.refresh();
        } catch {
          setError(true);
          setMessage("შენახვა ვერ მოხერხდა.");
        } finally {
          setPending(false);
        }
      }}
    >
      <div>
        <h2 className="text-sm font-medium">საინვესტიციო თეზისი</h2>
        <p className="mt-2 text-xs leading-6 text-muted">
          ჩაიწერეთ გადაწყვეტილების საფუძველი და პირობები, რომლებიც თქვენს ხედვას
          შეცვლის.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {(
          [
            ["thesis", "საინვესტიციო თეზისი"],
            ["entryReason", "რატომ გავხსენი პოზიცია"],
            ["catalysts", "კატალიზატორები"],
            ["invalidation", "თეზისის გაუქმების პირობები"],
            ["targets", "სამიზნე ფასები"],
            ["notes", "შენიშვნები"],
          ] as const
        ).map(([name, label]) => (
          <Field key={name} label={label}>
            <textarea
              name={name}
              rows={4}
              maxLength={
                name === "thesis" || name === "notes"
                  ? 10000
                  : name === "targets"
                    ? 2000
                    : 5000
              }
              defaultValue={initial?.[name] ?? ""}
              placeholder="ჩაწერეთ თქვენი მოსაზრება…"
            />
          </Field>
        ))}
        <Field label="დარწმუნებულობის დონე">
          <select
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
            name="horizon"
            maxLength={200}
            defaultValue={initial?.horizon ?? ""}
            placeholder="მაგ. 2–3 წელი"
          />
        </Field>
      </div>
      {message && <Message error={error}>{message}</Message>}
      {!preview && (
        <button className="button-primary" disabled={pending}>
          {pending ? "ინახება…" : "ჟურნალის შენახვა"}
        </button>
      )}
      {preview && (
        <p className="text-xs text-muted">
          სადემონსტრაციო ჩანაწერი არ ინახება.
        </p>
      )}
    </form>
  );
}
