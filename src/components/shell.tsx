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
  ChevronDown,
  Plus,
  ArrowUpRight,
  Bell,
  Menu,
  Search,
} from "lucide-react";
import { clsx } from "clsx";
import { useState } from "react";
import { Brand } from "./brand";
import { LogoutButton } from "./auth-buttons";
import { PortfolioCreate } from "./portfolio-create";
import { ThemeToggle } from "./theme-toggle";

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
  const path = usePathname(), router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const activeId = path.split("/")[2] ?? portfolios[0]?.id;
  const base = preview ? "/preview" : `/portfolios/${activeId}`;
  const sidebar = (
    <>
      <div className="px-3 pb-8 pt-2">
        <Brand />
      </div>
      <div className="mb-7 rounded-lg border border-line bg-raised/35 p-3">
        <div className="mb-2 text-[10px] font-semibold tracking-wide text-muted">აქტიური პორტფელი</div>
        <div className="relative">
          <select
            aria-label="პორტფელის არჩევა"
            value={preview ? "preview" : (activeId ?? "")}
            onChange={(e) => {
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
      <p className="eyebrow mb-3 px-3">MENU</p>
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
              aria-current={active ? "page" : undefined}
              className={clsx(
                "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-[12px] transition-colors",
                active
                  ? "border-brand/25 bg-brand/15 font-medium text-brand"
                  : "border-transparent text-muted hover:bg-raised hover:text-foreground",
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
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs text-muted hover:bg-raised"
        >
          <Eye size={17} />
          დაკვირვების სია
        </Link>
        <Link
          href={`${base}/settings`}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs text-muted hover:bg-raised"
        >
          <Settings2 size={17} />
          პარამეტრები
        </Link>
        {!preview && (
          <PortfolioCreate compact />
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
  const compactSidebar = (
    <div className="flex h-full flex-col items-center">
      <Brand compact />
      <nav className="mt-10 flex flex-col gap-2">
        {navigation.map(([segment, label, Icon]) => {
          const href = `${base}${segment ? `/${segment}` : ""}`;
          const active = path === href || (segment === "positions" && path.startsWith(`${href}/`));
          return <Link key={segment} href={href} aria-label={label} title={label} className={clsx("grid size-10 place-items-center rounded-lg border", active ? "border-brand/25 bg-brand/15 text-brand" : "border-transparent text-muted hover:bg-raised hover:text-foreground")}><Icon size={18}/></Link>;
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-2">
        <Link href={`${base}/watchlist`} aria-label="დაკვირვების სია" className="grid size-10 place-items-center rounded-lg text-muted hover:bg-raised"><Eye size={18}/></Link>
        <Link href={`${base}/settings`} aria-label="პარამეტრები" className="grid size-10 place-items-center rounded-lg text-muted hover:bg-raised"><Settings2 size={18}/></Link>
      </div>
    </div>
  );
  return (
    <div className="min-h-dvh">
      <aside className={clsx("fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-[#111a2b] py-5 transition-[width] duration-300 min-[981px]:flex",collapsed ? "w-[88px] px-3" : "w-[264px] px-4")}>
        {collapsed ? compactSidebar : sidebar}
      </aside>
      <div className={clsx("transition-[padding] duration-300",collapsed ? "min-[981px]:pl-[88px]" : "min-[981px]:pl-[264px]")}>
        <div className="flex items-center gap-1 overflow-x-auto border-b border-line bg-surface px-3 py-2 min-[981px]:hidden">
          <Brand compact />
          {navigation.map(([segment,label,Icon])=>{const href=`${base}${segment?`/${segment}`:""}`;const active=path===href||(segment==="positions"&&path.startsWith(`${href}/`));return <Link key={segment} href={href} className={clsx("flex min-w-max items-center gap-2 rounded-md border-b-2 px-3 py-2 text-xs",active?"border-brand bg-brand/10 text-foreground":"border-transparent text-muted")}><Icon size={15}/>{label}</Link>})}
        </div>
        <header className="flex h-[72px] items-center justify-between border-b border-line bg-surface/65 px-5 backdrop-blur sm:px-9">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setCollapsed((value) => !value)} className="hidden size-10 place-items-center rounded-lg border border-line bg-raised text-muted hover:text-foreground min-[981px]:grid" aria-label="მენიუს შეცვლა"><Menu size={18}/></button>
            <div className="hidden h-10 min-w-[260px] items-center gap-2 rounded-lg border border-line bg-raised/45 px-3 text-[11px] text-muted md:flex">
              <Search size={16}/><span>ძებნა ან ბრძანება...</span><kbd className="ml-auto rounded border border-line px-1.5 py-0.5 text-[9px]">⌘ K</kbd>
            </div>
            <div className="min-w-0 md:hidden">
              <span className="text-xs text-muted">პორტფელი</span>
              <span className="ml-2 text-xs">{preview ? "დემო" : "სამუშაო სივრცე"}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button className="grid size-9 place-items-center rounded-lg border border-line bg-raised/45 text-muted hover:text-foreground" aria-label="შეტყობინებები"><Bell size={16}/></button>
            <span className="numeric hidden rounded-md border border-line bg-surface px-3 py-1.5 text-xs text-muted sm:block">
              USD
            </span>
            {preview ? (
              <Link className="text-xs text-brand" href="/login">
                შესვლა <ArrowUpRight className="inline" size={14} />
              </Link>
            ) : (
              <span className="flex items-center gap-2 text-[10px] text-muted">
                <span className="size-1.5 rounded-full bg-positive" />
                {userName}
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
          className="mx-auto max-w-[1440px] px-5 py-7 sm:px-9 sm:py-9"
        >
          {children}
        </main>
        <footer className="mx-5 flex flex-wrap justify-between gap-3 border-t border-line py-5 text-[10px] text-muted sm:mx-9">
          <span>© {new Date().getFullYear()} Crypto Collective X</span>
          <span>ინფორმაცია და დაგეგმვა · გადაწყვეტილება თქვენია</span>
        </footer>
      </div>
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
  description: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-5 border-b border-line pb-6">
      <div>
        <p className="eyebrow mb-2">პორტფელი / {eyebrow}</p>
        <h1 className="text-2xl font-semibold tracking-[-.035em] sm:text-[28px]">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-xs leading-6 text-muted">{description}</p>
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
