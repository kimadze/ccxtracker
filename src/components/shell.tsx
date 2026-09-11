"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Layers3,
  ArrowLeftRight,
  ChartNoAxesCombined,
  FlaskConical,
  PieChart,
  Route,
  BookOpen,
  Settings2,
  Eye,
  LineChart,
  Menu,
  ChevronDown,
  Plus,
  ArrowUpRight,
} from "lucide-react";
import { useState } from "react";
import { clsx } from "clsx";
import { Brand } from "./brand";
import { Modal } from "./ui";
import { LogoutButton } from "./auth-buttons";
import { PortfolioCreate } from "./portfolio-create";

const navigation = [
  ["", "მიმოხილვა", LayoutDashboard],
  ["positions", "პოზიციები", Layers3],
  ["transactions", "ტრანზაქციები", ArrowLeftRight],
  ["analytics", "ანალიტიკა", ChartNoAxesCombined],
  ["statistics", "სტატისტიკა", LineChart],
  ["scenarios", "სცენარების ლაბორატორია", FlaskConical],
  ["allocation", "განაწილება", PieChart],
  ["strategy", "სტრატეგია", Route],
  ["journal", "ჟურნალი", BookOpen],
] as const;
export function Shell({
  children,
  portfolios,
  userName,
  preview = false,
}: {
  children: React.ReactNode;
  portfolios: { id: string; name: string }[];
  userName: string;
  preview?: boolean;
}) {
  const path = usePathname(),
    router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeId = path.split("/")[2] ?? portfolios[0]?.id;
  const base = preview ? "/preview" : `/portfolios/${activeId}`;
  const sidebar = (
    <>
      <div className="px-3 pb-9 pt-2">
        <Brand />
      </div>
      <div className="mb-7 rounded-xl border border-line bg-surface p-3">
        <div className="mb-2 text-[10px] text-muted">აქტიური პორტფელი</div>
        <div className="relative">
          <select
            aria-label="პორტფელის არჩევა"
            value={preview ? "preview" : (activeId ?? "")}
            onChange={(e) => {
              setMobileOpen(false);
              router.push(`/portfolios/${e.target.value}`);
            }}
            disabled={preview}
            className="appearance-none border-0 bg-transparent py-1 pl-0 pr-6 text-xs font-medium"
          >
            {portfolios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-0 top-2 text-muted"
            size={14}
          />
        </div>
      </div>
      <p className="eyebrow mb-3 px-3">სამუშაო სივრცე</p>
      <nav className="space-y-1">
        {navigation.map(([segment, label, Icon]) => {
          const href = `${base}${segment ? `/${segment}` : ""}`;
          const active =
            path === href ||
            (segment === "positions" && path.startsWith(`${href}/`));
          return (
            <Link
              key={segment}
              href={href}
              onClick={() => setMobileOpen(false)}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "flex items-center gap-3 rounded-lg px-3 py-3 text-[12px] transition-colors",
                active
                  ? "bg-brand/12 font-medium text-brand"
                  : "text-muted hover:bg-raised hover:text-foreground",
              )}
            >
              <Icon size={17} strokeWidth={1.65} />
              {label}
              {active && (
                <span className="ml-auto size-1 rounded-full bg-brand" />
              )}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto space-y-1 pt-8">
        <Link
          href={`${base}/watchlist`}
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-3 rounded-lg px-3 py-3 text-xs text-muted hover:bg-raised"
        >
          <Eye size={17} />
          დაკვირვების სია
        </Link>
        <Link
          href={`${base}/settings`}
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-3 rounded-lg px-3 py-3 text-xs text-muted hover:bg-raised"
        >
          <Settings2 size={17} />
          პარამეტრები
        </Link>
        {!preview && (
          <PortfolioCreate compact onCreated={() => setMobileOpen(false)} />
        )}
        <div className="mt-5 flex items-center gap-3 border-t border-line px-2 pt-5">
          <span className="flex size-8 items-center justify-center rounded-full bg-brand/15 text-xs text-brand">
            {userName.charAt(0)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs">{userName}</p>
            <p className="mt-1 text-[10px] text-muted">
              {preview ? "სადემონსტრაციო სივრცე" : "პირადი სივრცე"}
            </p>
          </div>
        </div>
        {!preview && <LogoutButton />}
      </div>
    </>
  );
  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] flex-col border-r border-line bg-[#131419] px-5 py-6 lg:flex">
        {sidebar}
      </aside>
      <div className="lg:pl-[232px]">
        <header className="flex h-[76px] items-center justify-between border-b border-line px-5 sm:px-9">
          <div className="flex items-center gap-3">
            <button
              aria-label="მენიუს გახსნა"
              className="p-2 text-muted lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={20} />
            </button>
            <span className="text-xs text-muted">პორტფელი</span>
            <span className="text-line">/</span>
            <span className="hidden text-xs sm:inline">
              {preview ? "დიზაინის მიმოხილვა" : "სამუშაო სივრცე"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-md border border-line px-2 py-1 text-[10px] tracking-wider text-muted sm:block">
              USD
            </span>
            {preview ? (
              <Link className="text-xs text-brand" href="/login">
                შესვლა <ArrowUpRight className="inline" size={14} />
              </Link>
            ) : (
              <span className="flex items-center gap-2 text-[10px] text-muted">
                <span className="size-1.5 rounded-full bg-brand" />
                პირადი პორტფელი
              </span>
            )}
          </div>
        </header>
        {preview && (
          <div className="border-b border-brand/15 bg-brand/5 px-5 py-2.5 text-center text-[11px] leading-5 text-brand">
            სადემონსტრაციო რეჟიმი · ნაჩვენები თანხები და ფასები გამოგონილია ·
            რეალური მონაცემები არ ინახება
          </div>
        )}
        <main
          id="main"
          className="mx-auto max-w-[1600px] px-5 py-7 sm:px-9 sm:py-9"
        >
          {children}
        </main>
        <footer className="mx-5 flex flex-wrap justify-between gap-3 border-t border-line py-5 text-[10px] text-muted sm:mx-9">
          <span>© {new Date().getFullYear()} Crypto Collective X</span>
          <span>ინფორმაცია და დაგეგმვა · გადაწყვეტილება თქვენია</span>
        </footer>
      </div>
      <Modal
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        title="ნავიგაცია"
        description="აირჩიეთ სამუშაო სივრცე"
      >
        <div className="flex min-h-[550px] flex-col">{sidebar}</div>
      </Modal>
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
      <div>
        <p className="eyebrow mb-2.5">{eyebrow}</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">
          {title}
        </h1>
        <p className="mt-2 text-xs leading-6 text-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
export function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="button-primary">
      <Plus size={16} />
      ტრანზაქციის დამატება
    </button>
  );
}
