"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight, BookOpen, ChartNoAxesCombined, ChevronDown, Command,
  Eye, EyeOff, FlaskConical, Gift, LayoutDashboard, LineChart, Menu, PieChart,
  Plus, Route, Search, Settings2, Wallet, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { clsx } from "clsx";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Brand } from "./brand";
import { LogoutButton } from "./auth-buttons";
import { PortfolioCreate } from "./portfolio-create";

type NavItem = [string, string, LucideIcon];
const privacyEvent = "ccx-balance-privacy";
const subscribePrivacy = (callback: () => void) => {
  window.addEventListener(privacyEvent, callback);
  return () => window.removeEventListener(privacyEvent, callback);
};
const readPrivacy = () => window.localStorage.getItem("ccx-hide-balances") === "true";
const serverPrivacy = () => false;
const groups: { title: string; links: NavItem[] }[] = [
  { title: "პორტფელი", links: [
    ["", "მიმოხილვა", LayoutDashboard],
    ["positions", "პოზიციები", Wallet],
    ["transactions", "ტრანზაქციები", ArrowLeftRight],
    ["airdrops", "Airdrop", Gift],
  ] },
  { title: "კვლევა", links: [
    ["analytics", "ანალიტიკა", ChartNoAxesCombined],
    ["statistics", "სტატისტიკა", LineChart],
    ["watchlist", "დაკვირვების სია", Eye],
  ] },
  { title: "დაგეგმვა", links: [
    ["allocation", "განაწილება", PieChart],
    ["strategy", "სტრატეგია", Route],
    ["scenarios", "სცენარები", FlaskConical],
    ["journal", "ჟურნალი", BookOpen],
  ] },
  { title: "ანგარიში", links: [["settings", "პარამეტრები", Settings2]] },
];

function Navigation({ base, path, compact, onNavigate }: {
  base: string;
  path: string;
  compact: boolean;
  onNavigate?: () => void;
}) {
  return <nav aria-label="მთავარი ნავიგაცია" className="flex-1 space-y-2">
    {groups.map((group) => <div key={group.title}>
      <p className="ccx-section-label nav-label">{group.title}</p>
      <div className="space-y-1">{group.links.map(([segment, label, Icon]) => {
        const href = base + (segment ? "/" + segment : "");
        const active = path === href || (segment === "positions" && path.startsWith(href + "/"));
        return <Link
          key={segment} href={href} aria-current={active ? "page" : undefined}
          aria-label={label} title={label}
          onClick={onNavigate}
          className={clsx("ccx-nav-link", compact && "justify-center")}
        ><Icon aria-hidden="true" size={18} strokeWidth={1.75} className="shrink-0" />
          <span className="nav-label truncate">{label}</span>
        </Link>;
      })}</div>
    </div>)}
  </nav>;
}

function BalancePrivacyToggle() {
  const hidden = useSyncExternalStore(subscribePrivacy, readPrivacy, serverPrivacy);

  useEffect(() => {
    if (!hidden) {
      document.documentElement.removeAttribute("data-balance-privacy");
      return;
    }
    document.documentElement.setAttribute("data-balance-privacy", "hidden");
  }, [hidden]);

  return <button
    type="button"
    className="ccx-icon-button ccx-privacy-toggle"
    aria-pressed={hidden}
    aria-label={hidden ? "თანხების ჩვენება" : "თანხების დამალვა"}
    title={hidden ? "თანხების ჩვენება" : "თანხების დამალვა"}
    onClick={() => {
      window.localStorage.setItem("ccx-hide-balances", String(!hidden));
      window.dispatchEvent(new Event(privacyEvent));
    }}
  >
    {hidden ? <EyeOff size={17} /> : <Eye size={17} />}
  </button>;
}

export function Shell({ children, portfolios, userName }: {
  children: React.ReactNode;
  portfolios: { id: string; name: string }[];
  userName: string;
}) {
  const path = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [query, setQuery] = useState("");
  const activeId = path.split("/")[2] ?? portfolios[0]?.id;
  const base = "/portfolios/" + activeId;
  const currentSection = groups.flatMap((group) => group.links)
    .find(([segment]) => path === base + (segment ? "/" + segment : "")
      || (segment === "positions" && path.startsWith(base + "/positions/")))?.[1] ?? "პორტფელი";
  const items = useMemo(() => groups.flatMap((group) => group.links.map(([segment, label, Icon]) => ({
    label, Icon, href: base + (segment ? "/" + segment : ""),
  }))), [base]);
  const matches = items.filter((item) => item.label.toLocaleLowerCase("ka").includes(query.trim().toLocaleLowerCase("ka")));
  const mobileLinks: NavItem[] = [
    ["", "მიმოხილვა", LayoutDashboard],
    ["positions", "პოზიციები", Wallet],
    ["transactions", "ტრანზაქციები", ArrowLeftRight],
    ["analytics", "ანალიტიკა", ChartNoAxesCombined],
  ];

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  return <div className="ccx-shell">
    <aside className={clsx("ccx-sidebar overflow-y-auto px-3 py-5", collapsed && "compact")} aria-label="გვერდითი მენიუ">
      <div className="mb-5 flex items-center px-1">
        <Brand compact={collapsed} />
      </div>
      <Navigation base={base} path={path} compact={collapsed} />
      <div className="mt-5 border-t border-line pt-4">
        {!collapsed && <div className="nav-label"><PortfolioCreate compact /></div>}
        <div className="nav-label"><LogoutButton /></div>
        <p className="nav-label mt-4 px-3 text-xs text-muted">Crypto Collective X</p>
      </div>
    </aside>
    <div className={clsx("ccx-content", collapsed && "compact")}>
      <header className="ccx-topbar">
        <div className="flex min-w-0 items-center gap-3">
          <div className="mobile-topbar-brand"><Brand compact /></div>
          <button type="button" className="ccx-icon-button desktop-menu-trigger" aria-label={collapsed ? "მენიუს გაშლა" : "მენიუს შეკუმშვა"} aria-expanded={!collapsed} onClick={() => setCollapsed((value) => !value)}><Menu size={18} /></button>
          <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
            <Dialog.Trigger asChild><button type="button" className="ccx-icon-button mobile-menu-trigger" aria-label="მენიუს გახსნა"><Menu size={19} /></button></Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70" />
              <Dialog.Content className="ccx-sidebar mobile fixed z-[51] overflow-y-auto px-3 py-5" aria-describedby={undefined}>
                <div className="mb-5 flex items-center justify-between px-1">
                  <Dialog.Title className="sr-only">მთავარი მენიუ</Dialog.Title>
                  <Brand />
                  <Dialog.Close className="ccx-icon-button" aria-label="მენიუს დახურვა"><X size={18} /></Dialog.Close>
                </div>
                <Navigation base={base} path={path} compact={false} onNavigate={() => setMobileOpen(false)} />
                <div className="mt-5 border-t border-line pt-4"><PortfolioCreate compact onCreated={() => setMobileOpen(false)} /><LogoutButton /></div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
          <div className="breadcrumb min-w-0 text-xs text-muted">
            <span>პორტფელი</span><span className="mx-2 text-foreground/30">/</span>
            <span className="truncate text-foreground">{currentSection}</span>
          </div>
          <Dialog.Root open={commandOpen} onOpenChange={(open) => { setCommandOpen(open); if (!open) setQuery(""); }}>
            <Dialog.Trigger asChild><button type="button" className="ccx-search" aria-label="გვერდების ძიება"><Search size={17} aria-hidden="true" /><span className="truncate">მოძებნეთ გვერდი...</span><kbd className="ml-auto rounded border border-line px-1.5 py-0.5 text-xs">Ctrl K</kbd></button></Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70" />
              <Dialog.Content className="fixed left-1/2 top-[12dvh] z-[51] w-[calc(100%-32px)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-surface" aria-describedby={undefined}>
                <Dialog.Title className="sr-only">გვერდების ძიება</Dialog.Title>
                <div className="flex items-center gap-3 border-b border-line px-4"><Command size={18} className="text-muted" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="მოძებნეთ გვერდი..." aria-label="გვერდის სახელი" className="border-0 bg-transparent focus:outline-none" /><Dialog.Close aria-label="დახურვა" className="ccx-icon-button"><X size={17} /></Dialog.Close></div>
                <div className="max-h-[55dvh] overflow-y-auto p-2">
                  {matches.map(({ label, Icon, href }) => <button key={href} type="button" onClick={() => { router.push(href); setCommandOpen(false); }} className="ccx-nav-link w-full text-left"><Icon size={17} />{label}</button>)}
                  {!matches.length && <p className="p-6 text-center text-xs text-muted">შედეგი ვერ მოიძებნა.</p>}
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
        <div className="flex min-w-0 items-center gap-3">
          <BalancePrivacyToggle />
          <label className="relative block w-[clamp(126px,17vw,220px)] min-w-0">
            <span className="sr-only">პორტფელის არჩევა</span>
            <select aria-label="პორტფელის არჩევა" value={activeId ?? ""} onChange={(event) => router.push("/portfolios/" + event.target.value)} className="min-w-0 appearance-none pr-8 text-xs">
              {portfolios.map((portfolio) => <option key={portfolio.id} value={portfolio.id}>{portfolio.name}</option>)}
            </select>
            <ChevronDown aria-hidden="true" size={14} className="pointer-events-none absolute right-2 top-3 text-muted" />
          </label>
          <details className="relative">
            <summary className="flex min-h-10 max-w-40 items-center gap-2 rounded-lg border border-line bg-raised px-2 text-xs" aria-label="მომხმარებლის მენიუ">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand/15 font-semibold text-brand">{userName.charAt(0)}</span>
              <span className="hidden truncate sm:block">{userName}</span><ChevronDown size={13} className="text-muted" />
            </summary>
            <div className="absolute right-0 top-12 z-40 w-48 rounded-xl border border-line bg-surface p-2">
              <Link href={base + "/settings"} className="ccx-nav-link"><Settings2 size={16} /> პარამეტრები</Link>
              <LogoutButton />
            </div>
          </details>
        </div>
      </header>
      <main id="main" className="ccx-main">{children}</main>
      <nav className="mobile-bottom-nav" aria-label="მობილური ნავიგაცია">
        {mobileLinks.map(([segment, label, Icon]) => {
          const href = base + (segment ? "/" + segment : "");
          const active = path === href || (segment === "positions" && path.startsWith(href + "/"));
          return <Link key={String(segment)} href={href} aria-current={active ? "page" : undefined} aria-label={String(label)} className="mobile-bottom-link"><Icon size={19} /><span>{label}</span></Link>;
        })}
        <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
          <Dialog.Trigger asChild><button type="button" className="mobile-bottom-link" aria-label="მეტი გვერდი"><Menu size={19} /><span>მეტი</span></button></Dialog.Trigger>
        </Dialog.Root>
      </nav>
      <footer className="mx-4 flex flex-wrap justify-between gap-3 border-t border-line py-5 text-xs text-muted sm:mx-6">
        <span>© {new Date().getFullYear()} Crypto Collective X</span>
        <span>ინფორმაცია და დაგეგმვა · გადაწყვეტილება თქვენია</span>
      </footer>
    </div>
  </div>;
}

export function PageHeading({ eyebrow, title, description, action }: {
  eyebrow: string;
  title: string;
  description: React.ReactNode;
  action?: React.ReactNode;
}) {
  return <div className="workspace-heading mb-7 flex flex-wrap items-end justify-between gap-4">
    <div><p className="eyebrow mb-2">პორტფელი / {eyebrow}</p>
      <h1 className="text-[clamp(24px,2.3vw,28px)] font-semibold tracking-tight">{title}</h1>
      <div className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</div>
    </div>{action}
  </div>;
}

export function AddButton({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} className="button-primary"><Plus size={16} />ტრანზაქციის დამატება</button>;
}
