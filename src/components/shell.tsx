"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  BookOpen,
  ChartNoAxesCombined,
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
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Brand } from "./brand";
import { LogoutButton } from "./auth-buttons";
import { PortfolioCreate } from "./portfolio-create";
import {
  privacyEvent,
  readPrivacy,
  serverPrivacy,
  subscribePrivacy,
} from "./balance-privacy";

type NavItem = [string, string, LucideIcon];
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
  onNavigate,
}: {
  base: string;
  path: string;
  onNavigate?: () => void;
}) {
  return (
    <ul
      aria-label="მთავარი ნავიგაცია"
      className="menu menu-md min-h-0 w-full flex-1 flex-nowrap gap-0.5 overflow-x-hidden overflow-y-auto overscroll-contain p-0"
    >
      {groups.map((group) => (
        <Fragment key={group.title}>
          <li
            className={
              "menu-title mt-1 px-3 py-1 text-xs lg:is-drawer-close:hidden"
            }
          >
            {group.title}
          </li>
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
                    active && "bg-primary/12 text-secondary font-medium",
                    "lg:is-drawer-close:justify-center lg:is-drawer-close:px-0",
                    "min-h-11 gap-2.5 rounded-field px-3 py-2 text-sm",
                  )}
                >
                  <Icon
                    aria-hidden="true"
                    size={18}
                    strokeWidth={1.75}
                    className="shrink-0"
                  />
                  <span
                    className={"nav-label truncate lg:is-drawer-close:hidden"}
                  >
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </Fragment>
      ))}
    </ul>
  );
}

export function BalancePrivacyToggle() {
  const hidden = useSyncExternalStore(
    subscribePrivacy,
    readPrivacy,
    serverPrivacy,
  );

  return (
    <button
      type="button"
      className="btn btn-square ccx-privacy-toggle"
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
}: {
  children: React.ReactNode;
  portfolios: { id: string; name: string }[];
  userName: string;
}) {
  const path = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreDialogRef = useRef<HTMLDialogElement>(null);
  const activeId = path.split("/")[2] ?? portfolios[0]?.id;
  const base = "/portfolios/" + activeId;
  const isOverview = path === base;
  const mobileLinks: NavItem[] = [
    ["", "მიმოხილვა", LayoutDashboard],
    ["positions", "პოზიციები", Wallet],
    ["transactions", "დამატება", Plus],
    ["statistics", "სტატისტიკა", ChartNoAxesCombined],
  ];
  const moreGroups = groups
    .map((group) => ({
      ...group,
      links: group.links.filter(
        ([segment]) =>
          segment === "transactions" ||
          !mobileLinks.some(([mobileSegment]) => mobileSegment === segment),
      ),
    }))
    .filter((group) => group.links.length);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const close = () => {
      let expanded = true;
      try {
        expanded = localStorage.getItem("ccx-sidebar-expanded") !== "false";
      } catch {}
      setDrawerOpen(media.matches && expanded);
      setMoreOpen(false);
    };
    close();
    media.addEventListener("change", close);
    return () => media.removeEventListener("change", close);
  }, []);

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
        checked={drawerOpen}
        onChange={(event) => setDrawerOpen(event.target.checked)}
      />
      <div className="drawer-content flex min-w-0 flex-1 flex-col bg-base-100">
        <header className="navbar sticky top-0 z-20 h-[52px] min-h-[52px] gap-2 border-b border-base-300 bg-base-100 px-4 py-1 lg:h-16 lg:px-5">
          <button
            type="button"
            className="btn btn-ghost btn-square hidden min-h-11 lg:flex"
            aria-label={drawerOpen ? "მენიუს შეკუმშვა" : "მენიუს გაშლა"}
            aria-expanded={drawerOpen}
            onClick={() => {
              const next = !drawerOpen;
              setDrawerOpen(next);
              try {
                localStorage.setItem("ccx-sidebar-expanded", String(next));
              } catch {}
            }}
          >
            <Menu size={18} />
          </button>
          <select
            className="select min-h-11 w-full min-w-0 flex-1 border-0 bg-transparent px-1 text-sm lg:max-w-64 lg:flex-none"
            aria-label="პორტფელის არჩევა"
            value={activeId ?? ""}
            onChange={(event) =>
              router.push("/portfolios/" + event.target.value)
            }
          >
            {portfolios.map((portfolio) => (
              <option key={portfolio.id} value={portfolio.id}>
                {portfolio.name}
              </option>
            ))}
          </select>
          <div className="ml-auto">
            <BalancePrivacyToggle />
          </div>
          <div
            id="overview-toolbar"
            className="hidden items-center gap-2 lg:flex"
          />
        </header>
        <main
          id="main"
          className={
            isOverview
              ? "mx-auto w-full min-w-0 max-w-[1600px] flex-1 px-4 pt-3 pb-[calc(80px+env(safe-area-inset-bottom))] lg:px-5 lg:py-4"
              : "mx-auto w-full min-w-0 max-w-[1600px] flex-1 px-4 pt-3 pb-[calc(80px+env(safe-area-inset-bottom))] text-sm lg:px-5 lg:py-4"
          }
        >
          {children}
        </main>
        <nav
          className="dock dock-sm md:dock-md mobile-bottom-nav"
          aria-label="მობილური ნავიგაცია"
        >
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
                <span className="dock-label max-md:hidden">{label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            className={clsx("mobile-bottom-link", moreOpen && "dock-active")}
            aria-label="მეტი გვერდი"
            onClick={() => setMoreOpen(true)}
          >
            <span className="mobile-bottom-icon">
              <Menu size={19} />
            </span>
            <span className="dock-label max-md:hidden">მეტი</span>
          </button>
        </nav>
        <dialog
          ref={moreDialogRef}
          aria-label="ყველა ხელსაწყო"
          className="modal modal-bottom"
          onClose={() => setMoreOpen(false)}
          onCancel={() => setMoreOpen(false)}
        >
          <div className="modal-box max-h-[85dvh] w-full max-w-xl overflow-y-auto rounded-t-box border border-base-300 bg-base-300 p-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-base-200 pb-2">
              <div>
                <h2 className="text-lg font-semibold">ყველა ხელსაწყო</h2>
                <p className="sr-only">კვლევა, დაგეგმვა და ანგარიშის მართვა</p>
              </div>
              <button
                type="button"
                className="btn btn-circle btn-ghost min-h-11 min-w-11 shrink-0"
                aria-label="დახურვა"
                onClick={() => setMoreOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <ul
              className="menu menu-md mt-2 w-full gap-1 p-0 sm:grid sm:grid-cols-2"
              aria-label="დამატებითი გვერდები"
            >
              {moreGroups.map((group) => (
                <Fragment key={group.title}>
                  <li className="menu-title mt-2 px-3 py-1 text-xs sm:col-span-2">
                    {group.title}
                  </li>
                  {group.links.map(([segment, label, Icon]) => {
                    const href = base + "/" + segment;
                    const active = path === href;
                    return (
                      <li key={segment} className="min-w-0">
                        <Link
                          href={href}
                          aria-current={active ? "page" : undefined}
                          onClick={() => setMoreOpen(false)}
                          className={clsx(
                            "min-h-12 min-w-0 gap-3 rounded-field px-3 py-2 text-left",
                            active && "menu-active",
                          )}
                        >
                          <span className="grid size-8 shrink-0 place-items-center rounded-selector bg-base-300 text-base-content/70">
                            <Icon size={19} />
                          </span>
                          <span className="min-w-0 whitespace-normal text-sm leading-5">
                            {label}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </Fragment>
              ))}
            </ul>
            <div className="mt-3 border-t border-base-300 pt-3">
              <LogoutButton />
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button aria-label="დახურვა">დახურვა</button>
          </form>
        </dialog>
      </div>
      <div className="drawer-side z-50 lg:z-30">
        <label
          htmlFor="ccx-main-drawer"
          aria-label="მენიუს დახურვა"
          className="drawer-overlay"
        />
        <aside
          className={clsx(
            "flex h-dvh w-60 max-w-[85vw] flex-col overflow-hidden border-r border-base-300 bg-base-200 px-3 py-3 text-base-content transition-[width,padding] duration-200 motion-reduce:transition-none",
            "lg:is-drawer-close:w-16 lg:is-drawer-close:px-2 lg:is-drawer-open:w-56",
          )}
          aria-label="გვერდითი მენიუ"
        >
          <div
            className={
              "mb-2 flex min-h-10 shrink-0 items-center px-1 lg:is-drawer-close:justify-center lg:is-drawer-close:px-0"
            }
          >
            <Brand
              compact={!drawerOpen}
              href="/portfolios"
              label="პორტფელების სია"
            />
          </div>
          <Navigation
            base={base}
            path={path}
            onNavigate={() => {
              if (window.matchMedia("(max-width: 1023px)").matches)
                setDrawerOpen(false);
            }}
          />
          <div className="mt-2 shrink-0 space-y-1 border-t border-base-300 pt-2 lg:is-drawer-close:hidden">
            <div className={"nav-label lg:is-drawer-close:hidden"}>
              <PortfolioCreate compact />
            </div>
            <div className={"nav-label lg:is-drawer-close:hidden"}>
              <LogoutButton />
            </div>
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
  actionClassName,
  icon,
}: {
  eyebrow: string;
  title: string;
  description: React.ReactNode;
  action?: React.ReactNode;
  actionClassName?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-3 lg:mb-4">
      <h1
        className="flex min-w-0 items-center gap-2 text-lg font-semibold lg:text-xl"
        title={eyebrow}
      >
        {icon}
        <span className="truncate">{title}</span>
      </h1>
      {description && <span className="sr-only">{description}</span>}
      {action && <div className={actionClassName}>{action}</div>}
    </div>
  );
}

export function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="btn btn-primary">
      <Plus size={16} />
      ტრანზაქციის დამატება
    </button>
  );
}
