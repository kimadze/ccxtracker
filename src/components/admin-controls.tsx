"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminAction } from "@/server/admin-actions";

export function AdminControls({
  initial,
}: {
  initial: {
    aiEnabled: boolean;
    userDailyLimit: number;
    globalDailyLimit: number;
  };
}) {
  const [enabled, setEnabled] = useState(initial.aiEnabled),
    [userLimit, setUserLimit] = useState(String(initial.userDailyLimit)),
    [globalLimit, setGlobalLimit] = useState(String(initial.globalDailyLimit));
  const [pending, start] = useTransition(),
    [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const router = useRouter();
  return (
    <form
      className="card card-border bg-base-200 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        setMessage("");
        start(async () => {
          try {
            const result = await adminAction("controls", {
              aiEnabled: enabled,
              userDailyLimit: Number(userLimit),
              globalDailyLimit: Number(globalLimit),
            });
            setMessage(result.ok ? "პარამეტრები შენახულია." : result.error!);
            setFailed(!result.ok);
            if (result.ok) router.refresh();
          } catch {
            setFailed(true);
            setMessage(
              "სერვერთან კავშირი ვერ დამყარდა. ველები შენარჩუნებულია; სცადე ხელახლა.",
            );
          }
        });
      }}
    >
      <fieldset className="fieldset gap-3" disabled={pending}>
        <legend className="fieldset-legend text-base">AI-ის მართვა</legend>
        <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
          ტექსტისა და სქრინშოტის დამუშავება
          <input
            className="toggle toggle-primary"
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2">
            მოთხოვნები / მომხმარებელი / 24სთ
            <input
              className="input w-full"
              type="number"
              min={1}
              max={100}
              required
              value={userLimit}
              onChange={(e) => setUserLimit(e.target.value)}
            />
          </label>
          <label className="grid gap-2">
            საერთო მოთხოვნები / 24სთ
            <input
              className="input w-full"
              type="number"
              min={1}
              max={5000}
              required
              value={globalLimit}
              onChange={(e) => setGlobalLimit(e.target.value)}
            />
          </label>
        </div>
        <p className="text-xs text-base-content/60">
          ტექსტი და სქრინშოტი ერთ ლიმიტს იყენებს. მიმდინარე მოთხოვნა შეიძლება
          უკვე დაწყებული იყოს.
        </p>
        <button
          className="btn btn-primary min-h-11 justify-self-start"
          disabled={pending}
        >
          {pending ? "ინახება…" : "შენახვა"}
        </button>
      </fieldset>
      <p
        role="status"
        className={
          message
            ? `alert alert-soft mt-2 text-sm ${failed ? "alert-error" : "alert-success"}`
            : "sr-only"
        }
      >
        {message}
      </p>
    </form>
  );
}

export function AdminOperation({
  kind,
  input,
  label,
  confirmation,
}: {
  kind: "suspend" | "retry";
  input: unknown;
  label: string;
  confirmation: string;
}) {
  const [pending, start] = useTransition(),
    [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const router = useRouter();
  return (
    <div className="min-w-0">
      <button
        className="btn btn-neutral min-h-11"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(confirmation)) return;
          setMessage("");
          start(async () => {
            try {
              const result = await adminAction(kind, input);
              setMessage(
                result.ok
                  ? kind === "retry"
                    ? "ჩანაწერი დაბრუნდა გაგზავნის რიგში."
                    : "წვდომის მდგომარეობა განახლდა."
                  : result.error!,
              );
              setFailed(!result.ok);
              if (result.ok) router.refresh();
            } catch {
              setFailed(true);
              setMessage(
                "სერვერთან კავშირი ვერ დამყარდა. განაახლე სია და გადაამოწმე შედეგი ხელახალ ცდამდე.",
              );
            }
          });
        }}
      >
        {pending ? "მუშავდება…" : label}
      </button>
      <p
        role="status"
        className={
          message
            ? `alert alert-soft mt-2 max-w-md text-xs ${failed ? "alert-error" : "alert-success"}`
            : "sr-only"
        }
      >
        {message}
      </p>
    </div>
  );
}
