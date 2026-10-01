"use client";

import * as Dialog from "@radix-ui/react-dialog";
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
import { useEffect, useState, useSyncExternalStore } from "react";
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
    <nav aria-label="მთავარი ნავიგაცია" className="menu flex-1 space-y-2">
      {groups.map((group) => (
        <div key={group.title}>
          <p className="ccx-section-label nav-label">{group.title}</p>
          <div className="space-y-1">
            {group.links.map(([segment, label, Icon]) => {
              const href = base + (segment ? "/" + segment : "");
              const active =
                path === href ||
                (segment === "positions" && path.startsWith(href + "/"));
              return (
                <Link
                  key={segment}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  aria-label={label}
                  title={label}
                  onClick={onNavigate}
                  className={clsx("ccx-nav-link", compact && "justify-center")}
                >
                  <Icon
                    aria-hidden="true"
                    size={18}
                    strokeWidth={1.75}
                    className="shrink-0"
                  />
                  <span className="nav-label truncate">{label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
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

  return (
    <div className="ccx-shell">
      <aside
        className={clsx(
          "ccx-sidebar overflow-y-auto px-3 py-5",
          collapsed && "compact",
        )}
        aria-label="გვერდითი მენიუ"
      >
        <div className="mb-5 flex items-center px-1">
          <Brand compact={collapsed} />
        </div>
        <Navigation base={base} path={path} compact={collapsed} />
        <div className="mt-5 border-t border-line pt-4">
          {!collapsed && (
            <div className="nav-label">
              <PortfolioCreate compact />
            </div>
          )}
          <div className="nav-label">
            <LogoutButton />
          </div>
          <p className="nav-label mt-4 px-3 text-xs text-muted">
            Crypto Collective X
          </p>
        </div>
      </aside>
      <div className={clsx("ccx-content", collapsed && "compact")}>
        <header className="ccx-topbar">
          <div className="flex min-w-0 items-center gap-3">
            <div className="mobile-topbar-brand">
              <Brand compact />
            </div>
            <button
              type="button"
              className="ccx-icon-button desktop-menu-trigger"
              aria-label={collapsed ? "მენიუს გაშლა" : "მენიუს შეკუმშვა"}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((value) => !value)}
            >
              <Menu size={18} />
            </button>
            <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
              <Dialog.Trigger asChild>
                <button
                  type="button"
                  className="ccx-icon-button mobile-menu-trigger"
                  aria-label="მენიუს გახსნა"
                >
                  <Menu size={19} />
                </button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70" />
                <Dialog.Content
                  className="ccx-sidebar mobile fixed z-[51] overflow-y-auto px-3 py-5"
                  aria-describedby={undefined}
                >
                  <div className="mb-5 flex items-center justify-between px-1">
                    <Dialog.Title className="sr-only">
                      მთავარი მენიუ
                    </Dialog.Title>
                    <Brand />
                    <Dialog.Close
                      className="ccx-icon-button"
                      aria-label="მენიუს დახურვა"
                    >
                      <X size={18} />
                    </Dialog.Close>
                  </div>
                  <Navigation
                    base={base}
                    path={path}
                    compact={false}
                    onNavigate={() => setMobileOpen(false)}
                  />
                  <div className="mt-5 border-t border-line pt-4">
                    <PortfolioCreate
                      compact
                      onCreated={() => setMobileOpen(false)}
                    />
                    <LogoutButton />
                  </div>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
            <div className="breadcrumb min-w-0 text-xs text-muted">
              <span>პორტფელი</span>
              <span className="mx-2 text-foreground/30">/</span>
              <span className="truncate text-foreground">{currentSection}</span>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <BalancePrivacyToggle />
            <label className="relative block w-[clamp(126px,17vw,220px)] min-w-0">
              <span className="sr-only">პორტფელის არჩევა</span>
              <select
                aria-label="პორტფელის არჩევა"
                value={activeId ?? ""}
                onChange={(event) =>
                  router.push("/portfolios/" + event.target.value)
                }
                className="min-w-0 appearance-none pr-8 text-xs"
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
            <details className="relative">
              <summary
                className="flex min-h-10 max-w-40 items-center gap-2 rounded-lg border border-line bg-raised px-2 text-xs"
                aria-label="მომხმარებლის მენიუ"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand/15 font-semibold text-brand">
                  {userName.charAt(0)}
                </span>
                <span className="hidden truncate sm:block">{userName}</span>
                <ChevronDown size={13} className="text-muted" />
              </summary>
              <div className="absolute right-0 top-12 z-40 w-48 rounded-xl border border-line bg-surface p-2">
                <Link href={base + "/settings"} className="ccx-nav-link">
                  <Settings2 size={16} /> პარამეტრები
                </Link>
                <LogoutButton />
              </div>
            </details>
          </div>
        </header>
        <main id="main" className="ccx-main">
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
                  segment === "transactions" && "mobile-bottom-primary",
                )}
              >
                <span className="mobile-bottom-icon">
                  <Icon size={segment === "transactions" ? 24 : 19} />
                </span>
                <span>{label}</span>
              </Link>
            );
          })}
          <Dialog.Root open={moreOpen} onOpenChange={setMoreOpen}>
            <Dialog.Trigger asChild>
              <button
                type="button"
                className="mobile-bottom-link"
                aria-label="მეტი გვერდი"
              >
                <Menu size={19} />
                <span>მეტი</span>
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="mobile-sheet-overlay" />
              <Dialog.Content
                className="modal-box mobile-bottom-sheet mobile-more-sheet"
                aria-describedby={undefined}
              >
                <div className="mobile-sheet-handle" aria-hidden="true" />
                <div className="mobile-sheet-heading">
                  <div>
                    <Dialog.Title>ყველა ხელსაწყო</Dialog.Title>
                    <p>კვლევა, დაგეგმვა და ანგარიშის მართვა</p>
                  </div>
                  <Dialog.Close
                    className="mobile-sheet-close"
                    aria-label="დახურვა"
                  >
                    <X size={18} />
                  </Dialog.Close>
                </div>
                <div className="mobile-more-grid">
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
                          <span>
                            <Icon size={19} />
                          </span>
                          <strong>{label}</strong>
                        </Link>
                      );
                    })}
                </div>
                <div className="mobile-more-account">
                  <LogoutButton />
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </nav>
        <footer className="mx-4 flex flex-wrap justify-between gap-3 border-t border-line py-5 text-xs text-muted sm:mx-6">
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
