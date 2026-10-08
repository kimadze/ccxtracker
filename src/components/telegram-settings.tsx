"use client";
import { useCallback, useEffect, useState } from "react";
import { Send, Unplug } from "lucide-react";
import {
  beginTelegramLink,
  confirmTelegramLink,
  disconnectTelegram,
  loadTelegramSettings,
  saveTelegramPreferences,
  testTelegramConnection,
} from "@/server/telegram/actions";
import { Message } from "./ui";
type Status = Extract<
  Awaited<ReturnType<typeof loadTelegramSettings>>,
  { ok: true }
>;
export function TelegramSettings({ portfolioId }: { portfolioId: string }) {
  const [status, setStatus] = useState<Status | null>(null),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false),
    [url, setUrl] = useState("");
  const refresh = useCallback(async () => {
    try {
      const reply = await loadTelegramSettings();
      if (reply.ok) setStatus(reply);
      else {
        setError(true);
        setMessage(reply.error);
      }
    } catch {
      setError(true);
      setMessage("Telegram-ის პარამეტრები ვერ ჩაიტვირთა.");
    }
  }, []);
  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    window.addEventListener("focus", refresh);
    return () => {
      clearTimeout(initial);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);
  useEffect(() => {
    if (!url) return;
    const timer = setInterval(() => void refresh(), 5000);
    return () => clearInterval(timer);
  }, [url, refresh]);
  async function perform(
    action: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
  ) {
    setPending(true);
    setMessage("");
    try {
      const reply = await action();
      setError(!reply.ok);
      setMessage(
        reply.ok ? success : (reply.error ?? "მოქმედება ვერ შესრულდა."),
      );
      if (reply.ok) await refresh();
      return reply.ok;
    } catch {
      setError(true);
      setMessage("მოქმედება ვერ შესრულდა.");
      return false;
    } finally {
      setPending(false);
    }
  }
  return (
    <section
      className="card bg-base-200 p-4"
      aria-labelledby="settings-telegram"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="settings-telegram"
          className="card-title scroll-mt-20 text-base"
        >
          <Send size={18} />
          Telegram
        </h2>
        <span className="flex items-center gap-2 text-xs">
          <span
            className={`status ${status?.connected ? "status-success" : "status-neutral"}`}
          />
          {status?.connected ? "დაკავშირებულია" : "არ არის დაკავშირებული"}
        </span>
      </div>
      {!status && !message && (
        <span
          className="loading loading-spinner loading-sm mt-3"
          aria-label="იტვირთება"
        />
      )}
      {status && !status.configured && (
        <p className="mt-3 text-sm text-base-content/60">
          @CCXTRACKER_BOT · სერვერის კონფიგურაცია დასასრულებელია.
        </p>
      )}
      {status?.configured && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-base-content/60">
            პირადი შეტყობინებები ფასის სამიზნის მიღწევაზე. აირჩიეთ პორტფელები და
            გაგზავნის ტიპები.
          </p>
          {status.connected && (
            <p className="text-sm">
              {status.username ?? "პირადი Telegram ჩატი"}
            </p>
          )}
          {status.lastError && (
            <Message error>
              ბოტი დაბლოკილია. გახსენით Telegram და მოხსენით ბლოკი.
            </Message>
          )}
          {status.awaitingConfirmation ? (
            <div className="space-y-2">
              <p className="text-sm">
                ეს თქვენი ჩატია? <strong>{status.pendingUsername}</strong>
              </p>
              <p className="text-xs text-base-content/60">
                დადასტურების შემდეგ არჩეული აქტივების სიმბოლოები და სამიზნე
                ფასები Telegram-ში გაიგზავნება.
              </p>
              <button
                className="btn btn-primary"
                disabled={pending}
                onClick={() =>
                  void perform(
                    confirmTelegramLink,
                    "Telegram დაკავშირებულია.",
                  ).then((ok) => {
                    if (ok) setUrl("");
                  })
                }
              >
                ჩატის დადასტურება
              </button>
            </div>
          ) : url ? (
            <div className="space-y-2">
              <a
                className="btn"
                href={url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Telegram-ის გახსნა
              </a>
              <p className="text-xs text-base-content/60">
                დააჭირეთ Start-ს და დაბრუნდით აქ დასადასტურებლად. ბმული
                მოქმედებს 10 წუთი.
              </p>
              <button
                className="btn btn-ghost"
                disabled={pending}
                onClick={() => void refresh()}
              >
                კავშირის შემოწმება
              </button>
            </div>
          ) : null}
          {!status.connected && !url && !status.awaitingConfirmation && (
            <button
              className="btn btn-primary"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                setMessage("");
                try {
                  const reply = await beginTelegramLink(portfolioId);
                  if (reply.ok) {
                    setUrl(reply.url);
                    await refresh();
                  } else {
                    setError(true);
                    setMessage(reply.error);
                  }
                } catch {
                  setError(true);
                  setMessage("დაკავშირება ვერ დაიწყო.");
                } finally {
                  setPending(false);
                }
              }}
            >
              Telegram-ის დაკავშირება
            </button>
          )}
          {status.connected && (
            <>
              <form
                key={`${status.buyEnabled}:${status.sellEnabled}:${status.portfolioIds.join(",")}`}
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  void perform(
                    () =>
                      saveTelegramPreferences({
                        buyEnabled: data.has("buy"),
                        sellEnabled: data.has("sell"),
                        portfolioIds: data.getAll("portfolio"),
                      }),
                    "შეტყობინებების არჩევანი შენახულია.",
                  );
                }}
              >
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {(
                    [
                      ["buy", "შესყიდვა", status.buyEnabled],
                      ["sell", "გაყიდვა", status.sellEnabled],
                    ] as const
                  ).map(([name, label, checked]) => (
                    <label key={name} className="label min-h-11 gap-3">
                      <input
                        type="checkbox"
                        className="toggle"
                        name={name}
                        defaultChecked={checked}
                        disabled={pending}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <fieldset className="fieldset">
                  <legend className="fieldset-legend">პორტფელები</legend>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {status.portfolios.map((p) => (
                      <label
                        key={p.id}
                        className="label min-h-11 justify-start gap-3 whitespace-normal"
                      >
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          name="portfolio"
                          value={p.id}
                          defaultChecked={status.portfolioIds.includes(p.id)}
                          disabled={pending}
                        />
                        <span className="min-w-0 truncate" title={p.name}>
                          {p.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <button className="btn" disabled={pending}>
                  არჩევანის შენახვა
                </button>
              </form>
              <div className="flex flex-wrap gap-2">
                <button
                  className="btn btn-ghost"
                  disabled={pending}
                  onClick={() =>
                    void perform(
                      testTelegramConnection,
                      "სატესტო შეტყობინება გაიგზავნა.",
                    )
                  }
                >
                  სატესტო შეტყობინება
                </button>
                <button
                  className="btn btn-ghost"
                  disabled={pending}
                  onClick={() =>
                    void perform(
                      disconnectTelegram,
                      "Telegram გათიშულია.",
                    ).then((ok) => {
                      if (ok) setUrl("");
                    })
                  }
                >
                  <Unplug size={16} />
                  გათიშვა
                </button>
              </div>
            </>
          )}
          {(url || status.awaitingConfirmation) && (
            <button
              className="btn btn-ghost"
              disabled={pending}
              onClick={() =>
                void perform(disconnectTelegram, "დაკავშირება გაუქმდა.").then(
                  (ok) => {
                    if (ok) setUrl("");
                  },
                )
              }
            >
              გაუქმება
            </button>
          )}
        </div>
      )}
      {message && (
        <div className="mt-3">
          <Message error={error}>{message}</Message>
        </div>
      )}
    </section>
  );
}
