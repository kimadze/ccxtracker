import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { isAdmin } from "@/server/admin-access";
import { adminService } from "@/server/admin";
import { getDb } from "@/server/db";
import { aiConfigured } from "@/server/ai/client";
import { telegramConfigured } from "@/server/telegram/api";
import { AdminControls, AdminOperation } from "@/components/admin-controls";
import { Brand } from "@/components/brand";
import { dateTime } from "@/lib/formatters";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "ადმინისტრირება — CCX",
  robots: { index: false, follow: false },
};
const tabs = [
  ["system", "სისტემა"],
  ["notifications", "შეტყობინებები"],
  ["ai", "AI"],
  ["users", "მომხმარებლები"],
  ["history", "ისტორია"],
];
const actions: Record<string, string> = {
  "ai-controls": "AI პარამეტრების შეცვლა",
  "user-suspended": "წვდომის შეჩერება",
  "user-restored": "წვდომის აღდგენა",
  "notification-retry": "გაგზავნის ხელახალი ცდა",
};
function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card card-border min-w-0 bg-base-200 p-4">
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}
function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-base-content/60">{label}</p>
      <p className="mt-1 break-words text-xl font-semibold tabular-nums">
        {value}
      </p>
    </div>
  );
}
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const user = await requireUser();
  if (!isAdmin(user)) notFound();
  const params = await searchParams,
    tab = tabs.some(([id]) => id === params.tab) ? params.tab! : "system";
  const page = Math.max(
    1,
    Math.min(10000, Math.floor(Number(params.page) || 1)),
  );
  const service = adminService(getDb(), user),
    data = await service.dashboard();
  const health = data.jobs.find((j) => j.key === "watchlist-health"),
    alertOk = Boolean(
      health &&
      health.leaseUntil.getTime() > data.preparedAt.getTime() - 15 * 60000,
    );
  return (
    <main
      id="main"
      className="mx-auto min-h-dvh max-w-[1600px] space-y-4 p-4 lg:p-5"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-base-300 pb-3">
        <Brand />
        <Link href="/portfolios" className="btn btn-ghost min-h-11">
          პორტფელებზე დაბრუნება
        </Link>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">ადმინისტრირება</h1>
        <p className="text-xs text-base-content/60">
          განახლდა {dateTime(data.preparedAt)} ·{" "}
          <Link href={`/admin?tab=${tab}`} className="link">
            განახლება
          </Link>
        </p>
      </div>
      <nav
        aria-label="ადმინისტრირების სექციები"
        className="tabs tabs-border max-w-full flex-nowrap overflow-x-auto"
      >
        {tabs.map(([id, label]) => (
          <Link
            key={id}
            href={`/admin?tab=${id}`}
            aria-current={tab === id ? "page" : undefined}
            className={`tab min-h-11 shrink-0 ${tab === id ? "tab-active" : ""}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {tab === "system" && (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <Panel title="მდგომარეობა">
              <ul className="list divide-y divide-base-300 text-sm">
                {[
                  ["ფასის ალერტები", alertOk ? "მუშაობს" : "შემოწმება საჭიროა"],
                  [
                    "Telegram",
                    telegramConfigured() ? "მომზადებულია" : "არ არის გამართული",
                  ],
                  [
                    "AI",
                    aiConfigured()
                      ? data.controls.aiEnabled
                        ? "ჩართულია"
                        : "გამორთულია"
                      : "გასაღები არ არის გამართული",
                  ],
                ].map(([label, status]) => (
                  <li
                    key={label}
                    className="flex min-h-11 items-center justify-between gap-3 py-2"
                  >
                    <span>{label}</span>
                    <span className="badge badge-outline h-auto py-1">
                      {status}
                    </span>
                  </li>
                ))}
                <li className="py-2 text-xs text-base-content/60">
                  ალერტების ბოლო სრული შემოწმება:{" "}
                  {health?.leaseUntil.getTime()
                    ? dateTime(health.leaseUntil)
                    : "—"}
                </li>
              </ul>
            </Panel>
            <Panel title="მონაცემები">
              <div className="grid grid-cols-2 gap-4">
                <Stat label="მომხმარებლები" value={data.users} />
                <Stat label="ქეშირებული ფასები" value={data.quotes.total} />
                <Stat label="15 წუთზე ძველი ფასები" value={data.quotes.stale} />
                <Stat label="Blob წაშლის რიგი" value={data.blobs.total} />
              </div>
              <p className="mt-3 text-xs text-base-content/60">
                წაშლის შეცდომები: {data.blobs.failed} · ქეშის ბოლო განახლება:{" "}
                {data.quotes.latest ? dateTime(data.quotes.latest) : "—"}
              </p>
            </Panel>
          </div>
          <Panel title="პროცესების ბოლო აქტივობა">
            <ul className="list divide-y divide-base-300">
              {data.jobs
                .filter((j) =>
                  [
                    "snapshots",
                    "market-refresh",
                    "watchlist-notifications",
                  ].includes(j.key),
                )
                .map((j) => (
                  <li
                    key={j.key}
                    className="flex flex-wrap justify-between gap-2 py-3 text-sm"
                  >
                    <span>
                      {
                        (
                          {
                            snapshots: "დღიური შეფასებები",
                            "market-refresh": "ფასების განახლება",
                            "watchlist-notifications": "ალერტების scheduler",
                          } as Record<string, string>
                        )[j.key]
                      }
                    </span>
                    <span className="text-base-content/60">
                      {dateTime(j.updatedAt)}
                    </span>
                  </li>
                ))}
            </ul>
            <p className="text-xs text-base-content/60">
              ბოლო აქტივობა პროცესის წარმატებას თავისთავად არ ადასტურებს.
            </p>
          </Panel>
        </>
      )}
      {tab === "ai" && (
        <>
          <Panel title="AI · ბოლო 24 საათი">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Stat label="მოთხოვნები" value={data.usage.requests} />
              <Stat label="ჩავარდნილი" value={data.usage.failed} />
              <Stat
                label="შეფასებული API ხარჯი"
                value={
                  data.usage.cost === null
                    ? "—"
                    : `$${Number(data.usage.cost).toFixed(6)}`
                }
              />
              <Stat label="ხარჯი უცნობია" value={data.usage.unknown} />
            </div>
            <p className="mt-3 text-xs text-base-content/60">
              მოდელი: GPT-6 Luna · აღრიცხვა იწყება ამ განახლებიდან. შეფასება
              ეფუძნება მიღებულ ტოკენებს; უცნობი ხარჯი ჯამში არ შედის. OpenAI-ის
              ანგარიშში გადაამოწმე საბოლოო ხარჯი.
            </p>
          </Panel>
          <AdminControls initial={data.controls} />
        </>
      )}
      {tab === "notifications" && (
        <Panel title="შეტყობინებები · ბოლო 50 ჩანაწერი">
          <ul className="list divide-y divide-base-300">
            {(await service.notifications()).map((row) => {
              const cancelled =
                  row.lastError === "CANCELLED" ||
                  row.lastError === "BOT_BLOCKED",
                stale =
                  data.preparedAt.getTime() - row.createdAt.getTime() >
                  6 * 3600000;
              return (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0 space-y-1 text-sm">
                    <p className="font-medium">
                      {
                        {
                          watchlist: "ფასის ალერტი",
                          digest: "დღიური ანგარიში",
                          "take-profit": "Take Profit",
                        }[row.kind]
                      }{" "}
                      ·{" "}
                      {row.sentAt
                        ? "გაგზავნილია"
                        : cancelled
                          ? "გაუქმებულია"
                          : stale
                            ? "ვადა გასულია"
                            : row.attempts
                              ? "ხელახალი ცდა"
                              : "მოლოდინში"}
                    </p>
                    <p className="text-xs text-base-content/60">
                      {dateTime(row.createdAt)} · ცდა {row.attempts}
                      {row.lastError ? ` · ${row.lastError}` : ""}
                    </p>
                  </div>
                  {!row.sentAt &&
                    !cancelled &&
                    !stale &&
                    row.attempts > 0 &&
                    row.nextAttemptAt <= data.preparedAt && (
                      <AdminOperation
                        kind="retry"
                        input={{ id: row.id, kind: row.kind }}
                        label="ხელახალი ცდა"
                        confirmation="ჩანაწერი ხელახალი გაგზავნის რიგში დაბრუნდება. თუ Telegram-მა წინა მოთხოვნა მიიღო, მაგრამ პასუხი დაიკარგა, შეტყობინება შეიძლება განმეორდეს. გაგრძელება?"
                      />
                    )}
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-base-content/60">
            ხელახალი ცდა შესრულდება scheduler-ის შემდეგ გაშვებაზე, მომხმარებლის
            მიმდინარე თანხმობის გადამოწმებით.
          </p>
        </Panel>
      )}
      {tab === "users" && (
        <Panel title="მომხმარებლები">
          <ul className="list divide-y divide-base-300">
            {(await service.members(page)).map((member) => (
              <li
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0 text-sm">
                  <p className="break-all font-medium">{member.email}</p>
                  <p className="text-xs text-base-content/60">
                    {dateTime(member.createdAt)} ·{" "}
                    {member.suspended
                      ? "წვდომა შეჩერებულია"
                      : isAdmin(member)
                        ? "ადმინისტრატორი"
                        : "აქტიური"}
                  </p>
                </div>
                {!isAdmin(member) && (
                  <AdminOperation
                    kind="suspend"
                    input={{ userId: member.id, suspended: !member.suspended }}
                    label={member.suspended ? "აღდგენა" : "შეჩერება"}
                    confirmation={
                      member.suspended
                        ? "აღდგეს მომხმარებლის წვდომა?"
                        : "მომხმარებლის სესიები დასრულდება და საიტზე წვდომა შეჩერდება. ფინანსური ჩანაწერები შენარჩუნდება. გაგრძელება?"
                    }
                  />
                )}
              </li>
            ))}
          </ul>
          <div className="join mt-3">
            <Link
              className={`btn join-item min-h-11 ${page <= 1 ? "btn-disabled" : ""}`}
              aria-disabled={page <= 1}
              href={`/admin?tab=users&page=${Math.max(1, page - 1)}`}
            >
              წინა
            </Link>
            <span className="btn join-item min-h-11 pointer-events-none">
              {page}
            </span>
            {page * 20 < data.users && (
              <Link
                className="btn join-item min-h-11"
                href={`/admin?tab=users&page=${page + 1}`}
              >
                შემდეგი
              </Link>
            )}
          </div>
        </Panel>
      )}
      {tab === "history" && (
        <Panel title="ადმინისტრაციული მოქმედებები · ბოლო 30">
          <ul className="list divide-y divide-base-300">
            {data.events.map((event) => (
              <li key={event.id} className="space-y-1 py-3 text-sm">
                <p className="font-medium">
                  {actions[event.action] ?? event.action}
                </p>
                <p className="break-all text-xs text-base-content/60">
                  {dateTime(event.createdAt)} · ადმინისტრატორი {event.actorId}
                  {event.targetId ? ` · ჩანაწერი ${event.targetId}` : ""}
                </p>
              </li>
            ))}
          </ul>
          {!data.events.length && (
            <p className="text-sm text-base-content/60">
              მოქმედებები ჯერ არ არის.
            </p>
          )}
        </Panel>
      )}
    </main>
  );
}
