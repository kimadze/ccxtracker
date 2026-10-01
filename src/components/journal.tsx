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
      className="space-y-5"
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
      <div className="card card-border bg-base-200"><div className="card-body">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">Investment note</span>
        <h2 className="card-title mt-1">საინვესტიციო თეზისი</h2>
        <p className="mt-2 text-sm leading-6 text-base-content/60">
          ჩაიწერეთ გადაწყვეტილების საფუძველი და პირობები, რომლებიც თქვენს ხედვას
          შეცვლის.
        </p>
      </div></div>
      <Field label="საინვესტიციო თეზისი">
        <textarea className="textarea textarea-bordered" name="thesis" rows={4} maxLength={10000} defaultValue={initial?.thesis ?? ""} placeholder="რა არის მთავარი არგუმენტი ამ პოზიციისთვის?" />
      </Field>
      <section className="card card-border bg-base-200"><div className="card-body">
        <header><h3 className="card-title text-base">შესვლა და მოლოდინი</h3><p className="text-sm text-base-content/60">რატომ არის ეს პოზიცია თქვენს პორტფელში და რა შეიძლება შეცვალოს მისი თეზისი.</p></header>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="რატომ გავხსენი პოზიცია"><textarea className="textarea textarea-bordered" name="entryReason" rows={3} maxLength={5000} defaultValue={initial?.entryReason ?? ""} placeholder="შესვლის მიზეზი…" /></Field>
          <Field label="კატალიზატორები"><textarea className="textarea textarea-bordered" name="catalysts" rows={3} maxLength={5000} defaultValue={initial?.catalysts ?? ""} placeholder="რა უნდა მოხდეს, რომ თეზისი გამყარდეს?" /></Field>
          <Field label="თეზისის გაუქმების პირობები"><textarea className="textarea textarea-bordered" name="invalidation" rows={3} maxLength={5000} defaultValue={initial?.invalidation ?? ""} placeholder="რომელი ფაქტი შეცვლის თქვენს ხედვას?" /></Field>
          <Field label="სამიზნე ფასები"><textarea className="textarea textarea-bordered" name="targets" rows={3} maxLength={2000} defaultValue={initial?.targets ?? ""} placeholder="სამიზნეები და გასვლის პირობები…" /></Field>
        </div>
      </div></section>
      <section className="card card-border bg-base-200"><div className="card-body">
        <header><h3 className="card-title text-base">რწმენა და დრო</h3><p className="text-sm text-base-content/60">მოკლე კონტექსტი, რომელიც შემდეგ გადახედვებს გაამარტივებს.</p></header>
        <div className="grid gap-5 md:grid-cols-2">
        <Field label="დარწმუნებულობის დონე">
          <select className="select select-bordered"
            name="conviction"
            defaultValue={initial?.conviction ?? "medium"}
          >
            <option value="low">დაბალი</option>
            <option value="medium">საშუალო</option>
            <option value="high">მაღალი</option>
          </select>
        </Field>
        <Field label="საინვესტიციო ჰორიზონტი">
          <input className="input input-bordered"
            name="horizon"
            maxLength={200}
            defaultValue={initial?.horizon ?? ""}
            placeholder="მაგ. 2–3 წელი"
          />
        </Field></div>
      </div></section>
      <Field label="დამატებითი შენიშვნები">
        <textarea className="textarea textarea-bordered" name="notes" rows={4} maxLength={10000} defaultValue={initial?.notes ?? ""} placeholder="გადახედვის შედეგი, პირადი შენიშვნა ან ბმული…" />
      </Field>
      {message && <Message error={error}>{message}</Message>}
      {!preview && (
        <button className="btn btn-primary" disabled={pending}>
          {pending && <span className="loading loading-spinner loading-xs" />}
          {pending ? "ინახება…" : "ჟურნალის შენახვა"}
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
