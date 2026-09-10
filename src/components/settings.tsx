"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, ShieldCheck } from "lucide-react";
import { renamePortfolio, removePortfolio } from "@/server/actions";
import { updateProfile, revokeSessions } from "@/server/settings-actions";
import { Field, Message, Modal } from "./ui";
import { dateTime } from "@/lib/formatters";
export function Settings({
  portfolioId,
  portfolioName,
  user,
  marketConfigured,
  lastQuote,
  preview = false,
}: {
  portfolioId: string;
  portfolioName: string;
  user: { name: string; email: string };
  marketConfigured: boolean;
  lastQuote: string | null;
  preview?: boolean;
}) {
  const [message, setMessage] = useState(""),
    [error, setError] = useState(false),
    [pending, setPending] = useState(false),
    [confirm, setConfirm] = useState<"portfolio" | "sessions" | null>(null);
  const router = useRouter();
  async function perform(
    action: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
  ) {
    setPending(true);
    setMessage("");
    try {
      const result = await action();
      setError(!result.ok);
      setMessage(
        result.ok ? success : (result.error ?? "მოქმედება ვერ შესრულდა."),
      );
      if (result.ok) router.refresh();
      return result.ok;
    } catch {
      setError(true);
      setMessage("მოქმედება ვერ შესრულდა.");
      return false;
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="space-y-6">
      {message && <Message error={error}>{message}</Message>}
      <div className="grid gap-6 lg:grid-cols-2">
        <form
          className="panel space-y-5 p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            if (preview) return;
            const name = new FormData(e.currentTarget).get("name");
            await perform(
              () => updateProfile({ name }),
              "პროფილი განახლებულია.",
            );
          }}
        >
          <h2 className="text-sm font-medium">პროფილი</h2>
          <Field label="სახელი">
            <input
              name="name"
              defaultValue={user.name}
              required
              maxLength={80}
              readOnly={preview}
            />
          </Field>
          <Field label="ელფოსტა">
            <input type="email" value={user.email} readOnly />
          </Field>
          <p className="text-xs text-muted">
            ელფოსტა დაკავშირებულია თქვენს Google ანგარიშთან.
          </p>
          {!preview && (
            <button className="button-secondary" disabled={pending}>
              პროფილის შენახვა
            </button>
          )}
        </form>
        <form
          className="panel space-y-5 p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            if (preview) return;
            const name = new FormData(e.currentTarget).get("name");
            await perform(
              () => renamePortfolio(portfolioId, { name }),
              "პორტფელის სახელი განახლებულია.",
            );
          }}
        >
          <h2 className="text-sm font-medium">პორტფელის პარამეტრები</h2>
          <Field label="პორტფელის სახელი">
            <input
              name="name"
              defaultValue={portfolioName}
              required
              maxLength={60}
              readOnly={preview}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="საანგარიშო ვალუტა">
              <input value="USD" readOnly />
            </Field>
            <Field label="საათობრივი სარტყელი">
              <input value="თბილისი (UTC+4)" readOnly />
            </Field>
          </div>
          <p className="text-xs leading-6 text-muted">
            ამ ვერსიაში შეფასებები გამოითვლება USD-ში. ტრანზაქციის შეყვანის დრო
            მითითებულია ფორმაში.
          </p>
          {!preview && (
            <button className="button-secondary" disabled={pending}>
              სახელის შენახვა
            </button>
          )}
        </form>
      </div>
      <section className="panel p-6">
        <h2 className="text-sm font-medium">მონაცემების წყარო</h2>
        <div className="mt-5 flex flex-wrap justify-between gap-4 text-xs">
          <span className="text-muted">ფასების წყარო</span>
          <a
            href="https://www.coingecko.com/"
            target="_blank"
            rel="noreferrer"
            className="text-brand"
          >
            CoinGecko
          </a>
        </div>
        <div className="mt-4 flex justify-between gap-4 text-xs">
          <span className="text-muted">მდგომარეობა</span>
          <span>
            {preview
              ? "სადემონსტრაციო მონაცემები"
              : marketConfigured
                ? "დაკავშირება კონფიგურირებულია"
                : "მონაცემების წყარო ჯერ არ არის დაკავშირებული"}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap justify-between gap-4 text-xs">
          <span className="text-muted">ბოლო ხელმისაწვდომი ფასის დრო</span>
          <span>{lastQuote ? dateTime(lastQuote) : "—"}</span>
        </div>
        <p className="mt-5 text-xs leading-6 text-muted">
          ფასების საერთო ქეში 5 წუთით ინახება. 15 წუთზე ძველი ფასი მონიშნულია
          როგორც მოძველებული. გამოტოვებული ფასი ნულად არ ითვლება.
        </p>
      </section>
      <section className="panel p-6">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <ShieldCheck size={17} className="text-brand" />
          მონაცემები და უსაფრთხოება
        </h2>
        <p className="mt-4 text-xs leading-7 text-muted">
          ჩამოტვირთეთ პორტფელის ტრანზაქციებისა და გეგმების ასლი. ფინანსური
          მონაცემების ფაილი შეინახეთ დაცულ ადგილას.
        </p>
        {!preview && (
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={`/api/portfolios/${portfolioId}/export`}
              className="button-secondary"
            >
              <Download size={15} />
              მონაცემების ჩამოტვირთვა
            </a>
            <button
              className="button-secondary"
              onClick={() => setConfirm("sessions")}
            >
              ყველა მოწყობილობიდან გასვლა
            </button>
          </div>
        )}
      </section>
      {!preview && (
        <section className="rounded-xl border border-negative/20 p-6">
          <h2 className="text-sm font-medium">პორტფელის წაშლა</h2>
          <p className="mt-3 text-xs leading-6 text-muted">
            წაიშლება ამ პორტფელის ტრანზაქციები, გეგმები, ჟურნალი და დანართები.
          </p>
          <button
            className="button-danger mt-5"
            onClick={() => setConfirm("portfolio")}
          >
            პორტფელის წაშლა
          </button>
        </section>
      )}
      <Modal
        open={confirm !== null}
        onOpenChange={(v) => {
          if (!v && !pending) setConfirm(null);
        }}
        title={
          confirm === "portfolio"
            ? "პორტფელის წაშლა"
            : "ყველა მოწყობილობიდან გასვლა"
        }
        description={
          confirm === "portfolio"
            ? "ეს მოქმედება შეუქცევადია. დასადასტურებლად ჩაწერეთ პორტფელის სახელი."
            : "ყველა მიმდინარე სესია დასრულდება, ამ მოწყობილობის ჩათვლით."
        }
      >
        <form
          className="space-y-5"
          onSubmit={async (e) => {
            e.preventDefault();
            if (confirm === "portfolio") {
              if (
                new FormData(e.currentTarget).get("confirm") !== portfolioName
              )
                return;
              if (
                await perform(
                  () => removePortfolio(portfolioId),
                  "პორტფელი წაიშალა.",
                )
              )
                router.replace("/portfolios");
            } else if (await perform(revokeSessions, "სესიები დასრულებულია."))
              router.replace("/login");
          }}
        >
          {confirm === "portfolio" && (
            <Field label={`პორტფელის სახელი: ${portfolioName}`}>
              <input name="confirm" required autoComplete="off" />
            </Field>
          )}
          {error && message && <Message error>{message}</Message>}
          <button className="button-danger" disabled={pending}>
            {pending ? "მიმდინარეობს…" : "დადასტურება"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
