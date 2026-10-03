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
  user: { name: string; email: string; cryptoOnlyPortfolioValue: boolean };
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
    <div className="grid items-start gap-3 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-4">
      <nav
        aria-label="პარამეტრების სექციები"
        className="hidden lg:sticky lg:top-20 lg:block"
      >
        <ul className="menu rounded-box border border-base-300 bg-base-200">
          {[
            ["profile", "პროფილი"],
            ["portfolio", "პორტფელი"],
            ["source", "მონაცემები"],
            ["security", "უსაფრთხოება"],
            ["danger", "წაშლა"],
          ].map(([id, label]) => (
            <li key={id}>
              <a href={`#settings-${id}`} className="min-h-11">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0 space-y-3">
        {message && <Message error={error}>{message}</Message>}
        <div className="grid gap-3 lg:gap-4">
          <form
            className="card card-border bg-base-200 p-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (preview) return;
              const form = new FormData(e.currentTarget);
              const name = form.get("name");
              await perform(
                () =>
                  updateProfile({
                    name,
                    cryptoOnlyPortfolioValue:
                      form.get("cryptoOnlyPortfolioValue") === "on",
                  }),
                "პროფილი განახლებულია.",
              );
            }}
          >
            <h2
              id="settings-profile"
              className="card-title scroll-mt-20 text-base"
            >
              პროფილი
            </h2>
            <Field label="სახელი">
              <input
                className="input"
                name="name"
                defaultValue={user.name}
                required
                maxLength={80}
                readOnly={preview}
              />
            </Field>
            <Field label="ელფოსტა">
              <input
                className="input"
                type="email"
                value={user.email}
                readOnly
              />
            </Field>
            <p className="text-xs text-base-content/60">
              ელფოსტა დაკავშირებულია თქვენს Google ანგარიშთან.
            </p>
            <label className="label cursor-pointer items-start justify-start gap-3 rounded-box bg-base-100 p-3 whitespace-normal">
              <input
                className="toggle toggle-primary shrink-0"
                type="checkbox"
                name="cryptoOnlyPortfolioValue"
                defaultChecked={user.cryptoOnlyPortfolioValue}
                disabled={preview}
              />
              <span className="min-w-0 text-sm">
                <strong>მხოლოდ კრიპტოაქტივების ღირებულება</strong>
                <small className="mt-1 block text-xs text-base-content/60">
                  მთავარ თანხაში არ ჩაითვლება ნაღდი ფული და სტეიბლკოინები.
                </small>
              </span>
            </label>
            {!preview && (
              <button
                className="btn btn-primary"
                disabled={pending}
                aria-busy={pending}
              >
                პროფილის შენახვა
              </button>
            )}
          </form>
          <form
            className="card card-border bg-base-200 p-4"
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
            <h2
              id="settings-portfolio"
              className="card-title scroll-mt-20 text-base"
            >
              პორტფელის პარამეტრები
            </h2>
            <Field label="პორტფელის სახელი">
              <input
                className="input"
                name="name"
                defaultValue={portfolioName}
                required
                maxLength={60}
                readOnly={preview}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="საანგარიშო ვალუტა">
                <input className="input" value="USD" readOnly />
              </Field>
              <Field label="საათობრივი სარტყელი">
                <input className="input" value="თბილისი (UTC+4)" readOnly />
              </Field>
            </div>
            <p className="text-xs leading-6 text-base-content/60">
              ამ ვერსიაში შეფასებები გამოითვლება USD-ში. ტრანზაქციის შეყვანის
              დრო მითითებულია ფორმაში.
            </p>
            {!preview && (
              <button
                className="btn btn-primary"
                disabled={pending}
                aria-busy={pending}
              >
                სახელის შენახვა
              </button>
            )}
          </form>
        </div>
        <section className="card card-border bg-base-200">
          <div className="card-body min-w-0 gap-3 p-4">
            <h2
              id="settings-source"
              className="card-title scroll-mt-20 text-base"
            >
              მონაცემების წყარო
            </h2>
            <div className="mt-1 flex flex-wrap justify-between gap-4 text-xs">
              <span className="text-base-content/60">ფასების წყარო</span>
              <a
                href="https://www.coingecko.com/"
                target="_blank"
                rel="noreferrer"
                className="link link-primary"
              >
                CoinGecko
              </a>
            </div>
            <div className="mt-1 flex justify-between gap-4 text-xs">
              <span className="text-base-content/60">მდგომარეობა</span>
              <span>
                {preview
                  ? "სადემონსტრაციო მონაცემები"
                  : marketConfigured
                    ? "დაკავშირება კონფიგურირებულია"
                    : "მონაცემების წყარო ჯერ არ არის დაკავშირებული"}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap justify-between gap-4 text-xs">
              <span className="text-base-content/60">
                ბოლო ხელმისაწვდომი ფასის დრო
              </span>
              <span>{lastQuote ? dateTime(lastQuote) : "—"}</span>
            </div>
            <details className="collapse collapse-arrow bg-base-100">
              <summary className="collapse-title min-h-11 py-3 text-xs">
                ფასების განახლების შესახებ
              </summary>
              <p className="collapse-content text-xs leading-6 text-base-content/60">
                ფასების საერთო ქეში 5 წუთით ინახება. 15 წუთზე ძველი ფასი
                მონიშნულია როგორც მოძველებული. გამოტოვებული ფასი ნულად არ
                ითვლება.
              </p>
            </details>
          </div>
        </section>
        <section className="card card-border bg-base-200">
          <div className="card-body min-w-0 gap-3 p-4">
            <h2
              id="settings-security"
              className="scroll-mt-20 flex items-center gap-2 text-sm font-medium"
            >
              <ShieldCheck size={17} className="text-primary" />
              მონაცემები და უსაფრთხოება
            </h2>
            <p className="mt-1 text-xs leading-6 text-base-content/60">
              ჩამოტვირთეთ პორტფელის ტრანზაქციებისა და გეგმების ასლი. ფინანსური
              მონაცემების ფაილი შეინახეთ დაცულ ადგილას.
            </p>
            {!preview && (
              <div className="mt-1 flex flex-wrap gap-3">
                <a
                  href={`/api/portfolios/${portfolioId}/export`}
                  className="btn btn-dash"
                >
                  <Download size={15} />
                  მონაცემების ჩამოტვირთვა
                </a>
                <button
                  className="btn btn-dash"
                  onClick={() => setConfirm("sessions")}
                >
                  ყველა მოწყობილობიდან გასვლა
                </button>
              </div>
            )}
          </div>
        </section>
        {!preview && (
          <section className="card card-border border-error/30 bg-error/5">
            <div className="card-body min-w-0 gap-3 p-4">
              <h2
                id="settings-danger"
                className="scroll-mt-20 text-sm font-medium"
              >
                პორტფელის წაშლა
              </h2>
              <p className="mt-3 text-xs leading-6 text-base-content/60">
                წაიშლება ამ პორტფელის ტრანზაქციები, გეგმები, ჟურნალი და
                დანართები.
              </p>
              <button
                className="btn btn-error mt-1"
                onClick={() => setConfirm("portfolio")}
              >
                პორტფელის წაშლა
              </button>
            </div>
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
            className="space-y-3 lg:space-y-4"
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
                <input
                  className="input"
                  name="confirm"
                  required
                  autoComplete="off"
                />
              </Field>
            )}
            {error && message && <Message error>{message}</Message>}
            <button className="btn btn-error" disabled={pending}>
              {pending ? "მიმდინარეობს…" : "დადასტურება"}
            </button>
          </form>
        </Modal>
      </div>
    </div>
  );
}
