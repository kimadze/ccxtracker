"use client";
import { createAuthClient } from "better-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, ArrowRight } from "lucide-react";
import { Message } from "./ui";
const auth = createAuthClient();
export function LoginButton({ enabled }: { enabled: boolean }) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="space-y-3">
      <button
        disabled={!enabled || pending}
        className="button-primary w-full"
        onClick={async () => {
          setPending(true);
          setError("");
          try {
            const result = await auth.signIn.social({
              provider: "google",
              callbackURL: "/portfolios",
              errorCallbackURL: "/login?error=1",
            });
            if (result.error) setError("შესვლა ვერ მოხერხდა. სცადეთ ხელახლა.");
          } catch {
            setError("კავშირი ვერ დამყარდა. სცადეთ ხელახლა.");
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "მიმდინარეობს შესვლა…" : "Google-ით შესვლა"}
        <ArrowRight size={16} />
      </button>
      {error && <Message error>{error}</Message>}
    </div>
  );
}
export function LogoutButton() {
  const router = useRouter();
  const [error, setError] = useState(false);
  return (
    <>
      <button
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs text-muted hover:bg-raised"
        onClick={async () => {
          try {
            const result = await auth.signOut();
            if (result.error) setError(true);
            else {
              router.replace("/login");
              router.refresh();
            }
          } catch {
            setError(true);
          }
        }}
      >
        <LogOut size={16} />
        გასვლა
      </button>
      {error && (
        <p role="alert" className="text-xs text-negative">
          გასვლა ვერ მოხერხდა.
        </p>
      )}
    </>
  );
}
