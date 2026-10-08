"use client";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const storageKey = `ccx:telegram-link:${portfolioId}`;
  const expiresAt = useRef(0);
  const clearPendingLink = useCallback(() => {
    setUrl("");
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // Linking also works when browser storage is unavailable.
    }
  }, [storageKey]);
  const refresh = useCallback(async () => {
    try {
      const reply = await loadTelegramSettings();
      if (reply.ok) {
        setStatus(reply);
        if (reply.connected) clearPendingLink();
      } else {
        setError(true);
        setMessage(reply.error);
      }
    } catch {
      setError(true);
      setMessage("Telegram-ის პარამეტრები ვერ ჩაიტვირთა.");
    }
  }, [clearPendingLink]);
  useEffect(() => {
    const initial = setTimeout(() => {
      try {
        const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
        if (
          typeof saved?.url === "string" &&
          /^https:\/\/t\.me\/[A-Za-z0-9_]{5,32}\?start=[A-Za-z0-9_-]{43}$/.test(
            saved.url,
          ) &&
          typeof saved.expiresAt === "number" &&
          saved.expiresAt > Date.now()
        ) {
          expiresAt.current = saved.expiresAt;
          setUrl(saved.url);
        } else sessionStorage.removeItem(storageKey);
      } catch {
        // Storage is an optional return-to-CCX convenience.
      }
      void refresh();
    }, 0);
    window.addEventListener("focus", refresh);
    return () => {
      clearTimeout(initial);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh, storageKey]);
  useEffect(() => {
    if (!url) return;
    const timer = setInterval(() => {
      if (expiresAt.current <= Date.now()) clearPendingLink();
      else void refresh();
    }, 5000);
    return () => clearInterval(timer);
  }, [url, refresh, clearPendingLink]);
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
            მიიღე ფასის შეტყობინებები Telegram-ში.
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
                    if (ok) clearPendingLink();
                  })
                }
              >
                ჩატის დადასტურება
              </button>
            </div>
          ) : url ? (
            <div className="space-y-2">
              <a className="btn btn-primary" href={url} rel="noreferrer">
                ბოტის გახსნა და დაკავშირება
              </a>
              <p className="text-xs text-base-content/60">
                Telegram-ში დააჭირე Start-ს, შემდეგ — „CCX-ში დაბრუნება“. ბმული
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
                    expiresAt.current = Date.now() + 600000;
                    try {
                      sessionStorage.setItem(
                        storageKey,
                        JSON.stringify({
                          url: reply.url,
                          expiresAt: expiresAt.current,
                        }),
                      );
                    } catch {
                      // Do not block navigation when storage is unavailable.
                    }
                    window.location.assign(reply.url);
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
              {pending ? "ბოტი იხსნება…" : "ბოტის გახსნა და დაკავშირება"}
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
                      if (ok) clearPendingLink();
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
                    if (ok) clearPendingLink();
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
