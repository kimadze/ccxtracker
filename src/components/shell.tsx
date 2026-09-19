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
  Gift,
  Command,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { useEffect, useMemo, useState } from "react";
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
  ["airdrops", "Airdrops", Gift],
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
  const [commandOpen, setCommandOpen] = useState(false);
  const [query, setQuery] = useState("");
  const activeId = path.split("/")[2] ?? portfolios[0]?.id;
  const base = preview ? "/preview" : `/portfolios/${activeId}`;
  const commandItems = useMemo(
    () => [
      ...navigation.map(([segment, label, Icon]) => ({ label, Icon, href: `${base}${segment ? `/${segment}` : ""}` })),
      { label: "დაკვირვების სია", Icon: Eye, href: `${base}/watchlist` },
      { label: "პარამეტრები", Icon: Settings2, href: `${base}/settings` },
    ],
    [base],
  );
  const matches = commandItems.filter((item) => item.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((value) => !value);
      }
      if (event.key === "Escape") setCommandOpen(false);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  const sidebar = (
    <>
      <div className="px-3 pb-6 pt-2">
        <Brand />
      </div>
      <div className="mb-7 rounded-2xl border border-line bg-raised/35 p-3.5">
        <div className="mb-2 text-[10px] font-medium tracking-wide text-muted">აქტიური პორტფელი</div>
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
      <p className="eyebrow mb-3 px-3">პორტფელი</p>
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
                "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-[12px] transition-colors",
                active
                  ? "border-brand bg-brand font-semibold text-[var(--bg)]"
                  : "border-transparent text-muted hover:bg-raised/75 hover:text-foreground",
              )}
            >
              <Icon size={17} strokeWidth={1.65} />
              {label}
              {active && (
                <span className="ml-auto size-1.5 rounded-full bg-[var(--bg)]" />
              )}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto space-y-1 pt-8">
        <p className="eyebrow mb-2 px-3">სამუშაო სივრცე</p>
        <Link
          href={`${base}/watchlist`}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs text-muted hover:bg-raised"
        >
          <Eye size={17} />
          დაკვირვების სია
        </Link>
        <Link
          href={`${base}/settings`}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs text-muted hover:bg-raised"
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
          return <Link key={segment} href={href} aria-label={label} title={label} className={clsx("grid size-10 place-items-center rounded-xl border", active ? "border-brand bg-brand text-[var(--bg)]" : "border-transparent text-muted hover:bg-raised hover:text-foreground")}><Icon size={18}/></Link>;
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-2">
        <Link href={`${base}/watchlist`} aria-label="დაკვირვების სია" className="grid size-10 place-items-center rounded-lg text-muted hover:bg-raised"><Eye size={18}/></Link>
        <Link href={`${base}/settings`} aria-label="პარამეტრები" className="grid size-10 place-items-center rounded-lg text-muted hover:bg-raised"><Settings2 size={18}/></Link>
      </div>
    </div>
  );
  return (
    <div className="min-h-dvh overflow-x-hidden">
      <aside className={clsx("fixed inset-y-3 left-3 z-30 hidden flex-col rounded-[24px] border border-line bg-surface/90 py-5 backdrop-blur-xl transition-[width] duration-300 min-[981px]:flex",collapsed ? "w-[76px] px-2" : "w-[274px] px-4")}>
        {collapsed ? compactSidebar : sidebar}
      </aside>
      <div className={clsx("transition-[padding] duration-300",collapsed ? "min-[981px]:pl-[100px]" : "min-[981px]:pl-[298px]")}>
        <div className="flex items-center gap-1 overflow-x-auto border-b border-line bg-surface/95 px-3 py-2 backdrop-blur min-[981px]:hidden">
          <Brand compact />
          {navigation.map(([segment,label,Icon])=>{const href=`${base}${segment?`/${segment}`:""}`;const active=path===href||(segment==="positions"&&path.startsWith(`${href}/`));return <Link key={segment} href={href} className={clsx("flex min-w-max items-center gap-2 rounded-md border-b-2 px-3 py-2 text-xs",active?"border-brand bg-brand/10 text-foreground":"border-transparent text-muted")}><Icon size={15}/>{label}</Link>})}
        </div>
        <header className="mx-3 mt-3 flex h-16 items-center justify-between rounded-[20px] border border-line bg-surface/80 px-5 backdrop-blur-xl sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setCollapsed((value) => !value)} className="hidden size-10 place-items-center rounded-xl border border-line bg-raised/65 text-muted hover:text-foreground min-[981px]:grid" aria-label="მენიუს შეცვლა"><Menu size={18}/></button>
            <button onClick={() => setCommandOpen(true)} className="hidden h-10 min-w-[310px] items-center gap-2 rounded-xl border border-line bg-raised/35 px-3 text-left text-[11px] text-muted hover:bg-raised md:flex">
              <Search size={15}/><span>ძებნა, გვერდი ან ბრძანება...</span><kbd className="ml-auto rounded-lg border border-line bg-surface px-1.5 py-0.5 text-[9px]">⌘ K</kbd>
            </button>
            <div className="min-w-0 md:hidden">
              <span className="text-xs text-muted">პორტფელი</span>
              <span className="ml-2 text-xs">{preview ? "დემო" : "სამუშაო სივრცე"}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button className="grid size-10 place-items-center rounded-xl border border-line bg-raised/45 text-muted hover:text-foreground" aria-label="შეტყობინებები"><Bell size={16}/></button>
            <span className="numeric hidden rounded-xl border border-line bg-raised/35 px-3 py-1.5 text-xs text-muted sm:block">
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
          <div className="mx-3 mt-3 rounded-xl border border-brand/20 bg-brand/5 px-5 py-2.5 text-center text-[11px] leading-5 text-brand">
            სადემონსტრაციო რეჟიმი · ნაჩვენები თანხები და ფასები გამოგონილია ·
            რეალური მონაცემები არ ინახება
          </div>
        )}
        <main
          id="main"
          className="mx-auto max-w-[1640px] px-5 py-7 sm:px-8 sm:py-9"
        >
          {children}
        </main>
        <footer className="mx-5 flex flex-wrap justify-between gap-3 border-t border-line py-5 text-[10px] text-muted sm:mx-8">
          <span>© {new Date().getFullYear()} Crypto Collective X</span>
          <span>ინფორმაცია და დაგეგმვა · გადაწყვეტილება თქვენია</span>
        </footer>
      </div>
      {commandOpen && (
        <div className="fixed inset-0 z-[70] grid place-items-start bg-black/50 px-4 pt-[12dvh] backdrop-blur-sm" onMouseDown={() => setCommandOpen(false)}>
          <div className="w-full max-w-xl overflow-hidden rounded-[20px] border border-line bg-surface" role="dialog" aria-modal="true" aria-label="ბრძანებების ძიება" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-line px-4"><Command size={18} className="text-muted"/><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="მოძებნეთ გვერდი ან მოქმედება..." className="border-0 bg-transparent px-0 py-4 text-sm shadow-none focus:outline-none"/><button onClick={() => setCommandOpen(false)} className="text-muted hover:text-foreground" aria-label="დახურვა"><X size={17}/></button></div>
            <div className="max-h-[50dvh] overflow-y-auto p-2">
              <p className="px-2 py-2 text-[10px] font-medium uppercase tracking-wider text-muted">ნავიგაცია</p>
              {matches.map(({ label, Icon, href }) => <button key={href} onClick={() => { router.push(href); setCommandOpen(false); setQuery(""); }} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-xs hover:bg-raised"><Icon size={16} className="text-muted"/>{label}</button>)}
              {!matches.length && <p className="px-3 py-8 text-center text-xs text-muted">შედეგი ვერ მოიძებნა.</p>}
            </div>
          </div>
        </div>
      )}
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
    <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
      <div>
        <p className="eyebrow mb-3 inline-flex rounded-full border border-line bg-surface/65 px-2.5 py-1">პორტფელი / {eyebrow}</p>
        <h1 className="text-3xl font-semibold tracking-[-.045em] sm:text-[34px]">
          {title}
        </h1>
        <div className="mt-2 max-w-2xl text-xs leading-6 text-muted">{description}</div>
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
