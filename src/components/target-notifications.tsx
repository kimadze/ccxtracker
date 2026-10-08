"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import {
  loadTargetNotifications,
  readTargetNotification,
} from "@/server/notification-actions";
import { BalanceValue, Message, Modal } from "./ui";
import { dateTime, unitPrice } from "@/lib/formatters";
type Reply = Awaited<ReturnType<typeof loadTargetNotifications>>;
type Notice = Extract<Reply, { ok: true }>["rows"][number];
export function TargetNotifications({ portfolioId }: { portfolioId: string }) {
  const [open, setOpen] = useState(false),
    [rows, setRows] = useState<Notice[]>([]),
    [error, setError] = useState(""),
    [pending, setPending] = useState<string | null>(null);
  const router = useRouter();
  const load = useCallback(async () => {
    try {
      const reply = await loadTargetNotifications(portfolioId);
      if (reply.ok) {
        setRows(reply.rows);
        setError("");
      } else setError(reply.error);
    } catch {
      setError("შეტყობინებები ვერ ჩაიტვირთა.");
    }
  }, [portfolioId]);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (!active || document.hidden) return;
      await load();
    };
    void refresh();
    const timer = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    window.addEventListener("ccx-watchlist-changed", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("ccx-watchlist-changed", refresh);
    };
  }, [load]);
  const unread = rows.filter((r) => !r.readAt).length;
  return (
    <>
      <button
        className="btn btn-ghost btn-square indicator"
        aria-label={`შეტყობინებები${unread ? ` · ${unread} წაუკითხავი` : ""}`}
        onClick={() => {
          setOpen(true);
          void load();
        }}
      >
        {unread > 0 && (
          <span className="indicator-item badge badge-primary badge-xs">
            {unread}
          </span>
        )}
        <Bell size={18} />
      </button>
      <Modal
        title="შეტყობინებები"
        description=""
        open={open}
        onOpenChange={setOpen}
      >
        {error && <Message error>{error}</Message>}
        <ul className="list max-h-[65dvh] overflow-y-auto">
          {rows.map((row) => (
            <li key={`${row.id}:${row.side}`} className="list-row block p-0">
              <button
                className="flex min-h-11 w-full items-start gap-3 p-3 text-left hover:bg-base-100 focus-visible:outline-primary"
                disabled={pending !== null}
                onClick={async () => {
                  setPending(row.id);
                  try {
                    const reply = await readTargetNotification(
                      portfolioId,
                      row.id,
                      row.reachedAt,
                      row.side,
                    );
                    if (reply.ok) {
                      setOpen(false);
                      setRows((old) =>
                        old.map((r) =>
                          r.id === row.id &&
                          r.side === row.side &&
                          r.reachedAt === row.reachedAt
                            ? { ...r, readAt: new Date().toISOString() }
                            : r,
                        ),
                      );
                      router.push(
                        `/portfolios/${portfolioId}/watchlist?asset=${encodeURIComponent(row.assetId)}`,
                      );
                    } else setError(reply.error);
                  } catch {
                    setError("მოქმედება ვერ შესრულდა.");
                  } finally {
                    setPending(null);
                  }
                }}
              >
                <span
                  className={`status mt-1 ${row.readAt ? "status-neutral" : "status-primary"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {row.symbol} ·{" "}
                    {row.side === "buy" ? "შესყიდვის" : "გაყიდვის"} ფასი
                    მიღწეულია
                  </p>
                  <p className="mt-1 text-xs">
                    <BalanceValue>
                      მიზანი {row.side === "buy" ? "≤" : "≥"}{" "}
                      {unitPrice(row.target)} · დაფიქსირდა{" "}
                      {unitPrice(row.price)}
                    </BalanceValue>
                  </p>
                  <p className="mt-1 text-xs text-base-content/60">
                    {dateTime(row.reachedAt)}
                  </p>
                </div>
              </button>
            </li>
          ))}
          {!rows.length && !error && (
            <li className="p-3 text-sm text-base-content/60">
              ახალი მიღწევები არ არის.
            </li>
          )}
        </ul>
      </Modal>
    </>
  );
}
