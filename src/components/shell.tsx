"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  BookOpen,
  ChartNoAxesCombined,
  ChevronDown,
  Eye,
  EyeOff,
  FlaskConical,
  Gift,
  LayoutDashboard,
  LineChart,
  Menu,
  PieChart,
  Plus,
  Route,
  Settings2,
  Wallet,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { clsx } from "clsx";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Brand } from "./brand";
import { LogoutButton } from "./auth-buttons";
import { PortfolioCreate } from "./portfolio-create";

type NavItem = [string, string, LucideIcon];
const privacyEvent = "ccx-balance-privacy";
const subscribePrivacy = (callback: () => void) => {
  window.addEventListener(privacyEvent, callback);
  return () => window.removeEventListener(privacyEvent, callback);
};
const readPrivacy = () =>
  window.localStorage.getItem("ccx-hide-balances") === "true";
const serverPrivacy = () => false;
const groups: { title: string; links: NavItem[] }[] = [
  {
    title: "პორტფელი",
    links: [
      ["", "მიმოხილვა", LayoutDashboard],
      ["positions", "პოზიციები", Wallet],
      ["transactions", "ტრანზაქციები", ArrowLeftRight],
      ["airdrops", "Airdrop", Gift],
    ],
  },
  {
    title: "კვლევა",
    links: [
      ["analytics", "ანალიტიკა", ChartNoAxesCombined],
      ["statistics", "სტატისტიკა", LineChart],
      ["watchlist", "დაკვირვების სია", Eye],
    ],
  },
  {
    title: "დაგეგმვა",
    links: [
      ["allocation", "განაწილება", PieChart],
      ["strategy", "სტრატეგია", Route],
      ["scenarios", "სცენარები", FlaskConical],
      ["journal", "ჟურნალი", BookOpen],
    ],
  },
  { title: "ანგარიში", links: [["settings", "პარამეტრები", Settings2]] },
];

function Navigation({
  base,
  path,
  compact,
  onNavigate,
}: {
  base: string;
  path: string;
  compact: boolean;
  onNavigate?: () => void;
}) {
  return (
    <ul aria-label="მთავარი ნავიგაცია" className="menu menu-md w-full flex-1 gap-1">
      {groups.map((group) => (
        <li key={group.title}>
          <h2 className="menu-title ccx-section-label nav-label">{group.title}</h2>
          <ul>
            {group.links.map(([segment, label, Icon]) => {
              const href = base + (segment ? "/" + segment : "");
              const active =
                path === href ||
                (segment === "positions" && path.startsWith(href + "/"));
              return (
                <li key={segment}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    aria-label={label}
                    title={label}
                    onClick={onNavigate}
                    className={clsx(
                      active && "menu-active",
                      compact && "justify-center",
                      "min-h-11 gap-3 rounded-field text-sm ccx-nav-link",
                    )}
                  >
                    <Icon
                      aria-hidden="true"
                      size={18}
                      strokeWidth={1.75}
                      className="shrink-0"
                    />
                    <span className="nav-label truncate">{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function BalancePrivacyToggle() {
  const hidden = useSyncExternalStore(
    subscribePrivacy,
    readPrivacy,
    serverPrivacy,
  );

  useEffect(() => {
    if (!hidden) {
      document.documentElement.removeAttribute("data-balance-privacy");
      return;
    }
    document.documentElement.setAttribute("data-balance-privacy", "hidden");
  }, [hidden]);

  return (
    <button
      type="button"
      className="btn btn-ghost btn-square ccx-icon-button ccx-privacy-toggle"
      aria-pressed={hidden}
      aria-label={hidden ? "თანხების ჩვენება" : "თანხების დამალვა"}
      title={hidden ? "თანხების ჩვენება" : "თანხების დამალვა"}
      onClick={() => {
        window.localStorage.setItem("ccx-hide-balances", String(!hidden));
        window.dispatchEvent(new Event(privacyEvent));
      }}
    >
      {hidden ? <EyeOff size={17} /> : <Eye size={17} />}
    </button>
  );
}

export function Shell({
  children,
  portfolios,
  userName,
}: {
  children: React.ReactNode;
  portfolios: { id: string; name: string }[];
  userName: string;
}) {
  const path = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreDialogRef = useRef<HTMLDialogElement>(null);
  const activeId = path.split("/")[2] ?? portfolios[0]?.id;
  const base = "/portfolios/" + activeId;
  const currentSection =
    groups
      .flatMap((group) => group.links)
      .find(
        ([segment]) =>
          path === base + (segment ? "/" + segment : "") ||
          (segment === "positions" && path.startsWith(base + "/positions/")),
      )?.[1] ?? "პორტფელი";
  const mobileLinks: NavItem[] = [
    ["", "მიმოხილვა", LayoutDashboard],
    ["positions", "პოზიციები", Wallet],
    ["transactions", "დამატება", Plus],
    ["analytics", "ანალიტიკა", ChartNoAxesCombined],
  ];
  const moreGroups = groups
    .map((group) => ({
      ...group,
      links: group.links.filter(
        ([segment]) =>
          !mobileLinks.some(([mobileSegment]) => mobileSegment === segment),
      ),
    }))
    .filter((group) => group.links.length);

  useEffect(() => {
    const dialog = moreDialogRef.current;
    if (!dialog) return;
    if (moreOpen && !dialog.open) dialog.showModal();
    if (!moreOpen && dialog.open) dialog.close();
  }, [moreOpen]);

  return (
    <div className="drawer lg:drawer-open min-h-screen bg-base-100 ccx-shell">
      <input
        id="ccx-main-drawer"
        type="checkbox"
        className="drawer-toggle"
        checked={mobileOpen}
        onChange={(event) => setMobileOpen(event.target.checked)}
      />
      <div className={clsx("drawer-content flex min-w-0 flex-1 flex-col bg-base-100", collapsed && "compact", "ccx-content")}>
        <header className="navbar sticky top-0 z-20 min-h-16 border-b border-base-300 bg-base-100/95 px-4 backdrop-blur-xl lg:px-6 ccx-topbar">
          <div className="navbar-start min-w-0 gap-3">
            <div className="mobile-topbar-brand">
              <Brand compact />
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-square desktop-menu-trigger ccx-icon-button"
              aria-label={collapsed ? "მენიუს გაშლა" : "მენიუს შეკუმშვა"}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((value) => !value)}
            >
              <Menu size={18} />
            </button>
            <label
              htmlFor="ccx-main-drawer"
              className="btn btn-ghost btn-square drawer-button mobile-menu-trigger ccx-icon-button"
              aria-label="მენიუს გახსნა"
            >
              <Menu size={19} />
            </label>
            <div className="breadcrumb min-w-0 text-xs text-muted">
              <span>პორტფელი</span>
              <span className="mx-2 text-foreground/30">/</span>
              <span className="truncate text-foreground">{currentSection}</span>
            </div>
          </div>
          <div className="navbar-end min-w-0 gap-3">
            <BalancePrivacyToggle />
            <label className="relative block w-[clamp(126px,17vw,220px)] min-w-0">
              <span className="sr-only">პორტფელის არჩევა</span>
              <select
                aria-label="პორტფელის არჩევა"
                value={activeId ?? ""}
                onChange={(event) =>
                  router.push("/portfolios/" + event.target.value)
                }
                className="select select-bordered min-w-0 appearance-none pr-8 text-xs"
              >
                {portfolios.map((portfolio) => (
                  <option key={portfolio.id} value={portfolio.id}>
                    {portfolio.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                aria-hidden="true"
                size={14}
                className="pointer-events-none absolute right-2 top-3 text-muted"
              />
            </label>
            <details className="dropdown dropdown-end relative">
              <summary
                className="btn btn-ghost min-h-10 max-w-40 items-center gap-2 border border-base-300 bg-base-200 px-2 text-xs"
                aria-label="მომხმარებლის მენიუ"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand/15 font-semibold text-brand">
                  {userName.charAt(0)}
                </span>
                <span className="hidden truncate sm:block">{userName}</span>
                <ChevronDown size={13} className="text-muted" />
              </summary>
              <div className="dropdown-content z-40 mt-2 w-48 rounded-box border border-base-300 bg-base-200 p-2 shadow-xl">
                <Link href={base + "/settings"} className="ccx-nav-link">
                  <Settings2 size={16} /> პარამეტრები
                </Link>
                <LogoutButton />
              </div>
            </details>
          </div>
        </header>
        <main id="main" className="container mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 lg:px-8 lg:py-8 ccx-main">
          {children}
        </main>
        <nav className="dock mobile-bottom-nav" aria-label="მობილური ნავიგაცია">
          {mobileLinks.map(([segment, label, Icon]) => {
            const href =
              segment === "transactions"
                ? base + "/transactions?new=1"
                : base + (segment ? "/" + segment : "");
            const active =
              path === href ||
              (segment === "positions" && path.startsWith(href + "/"));
            return (
              <Link
                key={String(segment)}
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={String(label)}
                className={clsx(
                  "mobile-bottom-link",
                  active && "dock-active",
                  segment === "transactions" && "mobile-bottom-primary",
                )}
              >
                <span className="mobile-bottom-icon">
                  <Icon size={segment === "transactions" ? 24 : 19} />
                </span>
                <span className="dock-label">{label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            className={clsx("mobile-bottom-link", moreOpen && "dock-active")}
            aria-label="მეტი გვერდი"
            onClick={() => setMoreOpen(true)}
          >
            <Menu size={19} />
            <span className="dock-label">მეტი</span>
          </button>
          <dialog
            ref={moreDialogRef}
            className="modal modal-bottom"
            onClose={() => setMoreOpen(false)}
            onCancel={() => setMoreOpen(false)}
          >
              <div className="modal-box max-h-[85dvh] rounded-t-box border border-base-300 bg-base-200">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">ყველა ხელსაწყო</h2>
                    <p className="mt-1 text-sm text-base-content/60">კვლევა, დაგეგმვა და ანგარიშის მართვა</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-circle btn-ghost btn-sm"
                    aria-label="დახურვა"
                    onClick={() => setMoreOpen(false)}
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  {moreGroups
                    .flatMap((group) => group.links)
                    .map(([segment, label, Icon]) => {
                      const href = base + "/" + segment;
                      const active = path === href;
                      return (
                        <Link
                          key={segment}
                          href={href}
                          aria-current={active ? "page" : undefined}
                          onClick={() => setMoreOpen(false)}
                        >
                          <span className="grid size-9 place-items-center rounded-selector bg-base-300 text-primary">
                            <Icon size={19} />
                          </span>
                          <strong>{label}</strong>
                        </Link>
                      );
                    })}
                </div>
                <div className="mt-5 border-t border-base-300 pt-4">
                  <LogoutButton />
                </div>
              </div>
              <form method="dialog" className="modal-backdrop">
                <button aria-label="დახურვა">დახურვა</button>
              </form>
          </dialog>
        </nav>
        <footer className="mx-4 flex flex-wrap justify-between gap-3 border-t border-line py-5 text-xs text-muted sm:mx-6">
          <span>© {new Date().getFullYear()} Crypto Collective X</span>
          <span>ინფორმაცია და დაგეგმვა · გადაწყვეტილება თქვენია</span>
        </footer>
      </div>
      <div className="drawer-side z-30">
        <label
          htmlFor="ccx-main-drawer"
          aria-label="მენიუს დახურვა"
          className="drawer-overlay"
        />
        <aside
          className={clsx(
            "flex min-h-full w-64 max-w-[85vw] flex-col overflow-y-auto border-r border-base-300 bg-base-200 px-3 py-5 text-base-content",
            collapsed && "compact",
          )}
          aria-label="გვერდითი მენიუ"
        >
          <div className="mb-5 flex items-center px-1">
            <Brand compact={collapsed} />
          </div>
          <Navigation
            base={base}
            path={path}
            compact={collapsed}
            onNavigate={() => setMobileOpen(false)}
          />
          <div className="mt-5 border-t border-base-300 pt-4">
            {!collapsed && (
              <div className="nav-label">
                <PortfolioCreate compact />
              </div>
            )}
            <div className="nav-label">
              <LogoutButton />
            </div>
            <p className="nav-label mt-4 px-3 text-xs text-base-content/50">
              Crypto Collective X
            </p>
          </div>
        </aside>
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
    <div className="workspace-heading mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow mb-2">პორტფელი / {eyebrow}</p>
        <h1 className="text-[clamp(24px,2.3vw,28px)] font-semibold tracking-tight">
          {title}
        </h1>
        <div className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          {description}
        </div>
      </div>
      {action}
    </div>
  );
}

export function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="btn btn-primary button-primary">
      <Plus size={16} />
      ტრანზაქციის დამატება
    </button>
  );
}
