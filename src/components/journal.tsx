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
      className="journal-workspace space-y-4"
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
      <div className="journal-heading">
        <span>INVESTMENT NOTE</span>
        <h2 className="text-sm font-medium">საინვესტიციო თეზისი</h2>
        <p className="mt-2 text-xs leading-6 text-muted">
          ჩაიწერეთ გადაწყვეტილების საფუძველი და პირობები, რომლებიც თქვენს ხედვას
          შეცვლის.
        </p>
      </div>
      <Field label="საინვესტიციო თეზისი">
        <textarea name="thesis" rows={4} maxLength={10000} defaultValue={initial?.thesis ?? ""} placeholder="რა არის მთავარი არგუმენტი ამ პოზიციისთვის?" />
      </Field>
      <section className="journal-section">
        <header><h3>შესვლა და მოლოდინი</h3><p>რატომ არის ეს პოზიცია თქვენს პორტფელში და რა შეიძლება შეცვალოს მისი თეზისი.</p></header>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="რატომ გავხსენი პოზიცია"><textarea name="entryReason" rows={3} maxLength={5000} defaultValue={initial?.entryReason ?? ""} placeholder="შესვლის მიზეზი…" /></Field>
          <Field label="კატალიზატორები"><textarea name="catalysts" rows={3} maxLength={5000} defaultValue={initial?.catalysts ?? ""} placeholder="რა უნდა მოხდეს, რომ თეზისი გამყარდეს?" /></Field>
          <Field label="თეზისის გაუქმების პირობები"><textarea name="invalidation" rows={3} maxLength={5000} defaultValue={initial?.invalidation ?? ""} placeholder="რომელი ფაქტი შეცვლის თქვენს ხედვას?" /></Field>
          <Field label="სამიზნე ფასები"><textarea name="targets" rows={3} maxLength={2000} defaultValue={initial?.targets ?? ""} placeholder="სამიზნეები და გასვლის პირობები…" /></Field>
        </div>
      </section>
      <section className="journal-section">
        <header><h3>რწმენა და დრო</h3><p>მოკლე კონტექსტი, რომელიც შემდეგ გადახედვებს გაამარტივებს.</p></header>
        <div className="grid gap-5 md:grid-cols-2">
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
        </Field></div>
      </section>
      <Field label="დამატებითი შენიშვნები">
        <textarea name="notes" rows={4} maxLength={10000} defaultValue={initial?.notes ?? ""} placeholder="გადახედვის შედეგი, პირადი შენიშვნა ან ბმული…" />
      </Field>
      {message && <Message error={error}>{message}</Message>}
      {!preview && (
        <button className="btn btn-primary button-primary" disabled={pending}>
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
