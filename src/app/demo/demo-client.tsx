"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Check,
  ChevronRight,
  Eye,
  Gift,
  BookOpen,
  FlaskConical,
  LayoutDashboard,
  LineChart,
  Menu,
  PieChart,
  Plus,
  QrCode,
  Settings2,
  Search,
  ShieldCheck,
  Star,
  Target,
  TrendingUp,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Brand } from "@/components/brand";
import { AssetIcon } from "@/components/positions";

type Screen =
  | "overview"
  | "positions"
  | "transactions"
  | "airdrops"
  | "analytics"
  | "statistics"
  | "watchlist"
  | "allocation"
  | "strategy"
  | "scenarios"
  | "journal"
  | "settings";

const navigation: Array<{
  screen: Screen;
  label: string;
  group: "პორტფელი" | "კვლევა" | "დაგეგმვა" | "ანგარიში";
  icon: LucideIcon;
}> = [
  { screen: "overview", label: "მიმოხილვა", group: "პორტფელი", icon: LayoutDashboard },
  { screen: "positions", label: "პოზიციები", group: "პორტფელი", icon: Wallet },
  { screen: "transactions", label: "ტრანზაქციები", group: "პორტფელი", icon: ArrowLeftRight },
  { screen: "airdrops", label: "Airdrop", group: "პორტფელი", icon: Gift },
  { screen: "analytics", label: "ანალიტიკა", group: "კვლევა", icon: BarChart3 },
  { screen: "statistics", label: "სტატისტიკა", group: "კვლევა", icon: LineChart },
  { screen: "watchlist", label: "დაკვირვება", group: "კვლევა", icon: Star },
  { screen: "allocation", label: "განაწილება", group: "დაგეგმვა", icon: PieChart },
  { screen: "strategy", label: "სტრატეგია", group: "დაგეგმვა", icon: Target },
  { screen: "scenarios", label: "სცენარები", group: "დაგეგმვა", icon: FlaskConical },
  { screen: "journal", label: "ჟურნალი", group: "დაგეგმვა", icon: BookOpen },
  { screen: "settings", label: "პარამეტრები", group: "ანგარიში", icon: Settings2 },
];

const screenTitles = Object.fromEntries(
  navigation.map((item) => [item.screen, item.label]),
) as Record<Screen, string>;
const assets = [
  {
    name: "Bitcoin",
    symbol: "BTC",
    quantity: "0.4346 BTC",
    price: "$42,384.20",
    value: "$18,420.32",
    pnl: "+4.28%",
    logoUrl:
      "https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png",
  },
  {
    name: "Ethereum",
    symbol: "ETH",
    quantity: "4.0648 ETH",
    price: "$2,284.10",
    value: "$9,284.10",
    pnl: "+2.14%",
    logoUrl:
      "https://coin-images.coingecko.com/coins/images/279/large/ethereum.png",
  },
  {
    name: "Solana",
    symbol: "SOL",
    quantity: "22 SOL",
    price: "$142.86",
    value: "$3,142.86",
    pnl: "+5.60%",
    logoUrl:
      "https://coin-images.coingecko.com/coins/images/4128/large/solana.png",
  },
  {
    name: "XRP",
    symbol: "XRP",
    quantity: "1,933 XRP",
    price: "$0.624",
    value: "$1,206.24",
    pnl: "−0.41%",
    logoUrl:
      "https://coin-images.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png",
  },
  {
    name: "Cardano",
    symbol: "ADA",
    quantity: "3,412 ADA",
    price: "$0.39",
    value: "$1,330.68",
    pnl: "+1.32%",
    logoUrl:
      "https://coin-images.coingecko.com/coins/images/975/large/cardano.png",
  },
  {
    name: "Chainlink",
    symbol: "LINK",
    quantity: "82 LINK",
    price: "$14.52",
    value: "$1,190.64",
    pnl: "−0.86%",
    logoUrl:
      "https://coin-images.coingecko.com/coins/images/877/large/chainlink-new-logo.png",
  },
];
const transactions = [
  {
    kind: "შესყიდვა",
    asset: "BTC",
    detail: "0.024 BTC · $41,820.00",
    amount: "−$1,003.68",
    date: "დღეს, 14:32",
    direction: "in",
  },
  {
    kind: "შეტანა",
    asset: "USD",
    detail: "პორტფელის დაფინანსება",
    amount: "+$2,500.00",
    date: "29 სექ, 18:10",
    direction: "in",
  },
  {
    kind: "გაყიდვა",
    asset: "ETH",
    detail: "0.40 ETH · $2,310.50",
    amount: "+$924.20",
    date: "27 სექ, 11:44",
    direction: "out",
  },
  {
    kind: "Airdrop მიღება",
    asset: "SOL",
    detail: "Jupiter · Solana",
    amount: "+$142.86",
    date: "24 სექ, 09:15",
    direction: "in",
  },
  {
    kind: "საკომისიო",
    asset: "USD",
    detail: "ტრანზაქციის საკომისიო",
    amount: "−$4.20",
    date: "24 სექ, 09:15",
    direction: "out",
  },
] as const;
const kinds = [
  "შესყიდვა",
  "გაყიდვა",
  "შეტანა",
  "გატანა",
  "საკომისიო",
  "Airdrop მიღება",
];

export function DemoClient() {
  const [screen, setScreen] = useState<Screen>("overview");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [kind, setKind] = useState("შესყიდვა");
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const filteredAssets = useMemo(
    () =>
      assets.filter((x) =>
        `${x.name} ${x.symbol}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [query],
  );
  const filteredTransactions = useMemo(
    () =>
      transactions.filter((x) =>
        `${x.kind} ${x.asset} ${x.detail}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [query],
  );
  const openForm = () => {
    setStatus("idle");
    setModal(true);
  };
  const navigate = (next: Screen) => {
    setScreen(next);
    setQuery("");
    setMoreOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("loading");
    window.setTimeout(() => setStatus("success"), 550);
  };

  return (
    <main className={`wallet-hybrid is-${screen}`}>
      <aside className="wallet-hybrid-sidebar">
        <Brand />
        <nav>
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.screen}
                className={`menu-item btn btn-ghost justify-start ${screen === item.screen ? "active" : ""}`}
                onClick={() => navigate(item.screen)}
              >
                <Icon size={18} /> {item.label}
              </button>
            );
          })}
        </nav>
        <div className="wallet-hybrid-side-note">
          <i />
          <span>
            <b>ფასები განახლებულია</b>
            <small>ბოლო სინქრონიზაცია ახლახან</small>
          </span>
        </div>
      </aside>

      <section className="wallet-hybrid-app">
        <header className="wallet-hybrid-topbar">
          <div className="mobile-wallet-tools">
            <button className="btn btn-ghost btn-square" aria-label="პროფილი">
              <UserRound size={24} />
            </button>
            <button className="btn btn-ghost btn-square" aria-label="QR კოდი">
              <QrCode size={22} />
            </button>
          </div>
          <label>
            <Search size={16} />
            <input className="input input-bordered"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                screen === "transactions" ? "ტრანზაქციის ძიება" : "აქტივის ძიება"
              }
            />
          </label>
          <button className="btn btn-ghost btn-square" aria-label="შეტყობინებები">
            <Bell size={18} />
          </button>
          <button className="btn btn-ghost btn-square" aria-label="თანხების დამალვა">
            <Eye size={18} />
          </button>
        </header>
        <div className="wallet-hybrid-content">
          <header className="wallet-hybrid-heading">
            <div>
              <small>კრიპტო კოლექცია</small>
              <h1>{screenTitles[screen]}</h1>
            </div>
            <button className="wallet-hybrid-primary" onClick={openForm}>
              <Plus size={17} /> ტრანზაქციის დამატება
            </button>
          </header>
          {screen === "overview" ? (
            <Overview
              queryAssets={filteredAssets}
              openForm={openForm}
              navigate={navigate}
            />
          ) : screen === "transactions" ? (
            <History items={filteredTransactions} />
          ) : (
            <FeatureScreen screen={screen} queryAssets={filteredAssets} navigate={navigate} />
          )}
        </div>
        <nav className="wallet-hybrid-bottom">
          <button
            className={`btn btn-ghost ${screen === "overview" ? "active" : ""}`}
            onClick={() => navigate("overview")}
          >
            <LayoutDashboard size={19} />
            <span>მიმოხილვა</span>
          </button>
          <button
            className={`btn btn-ghost ${screen === "positions" ? "active" : ""}`}
            onClick={() => navigate("positions")}
          >
            <Wallet size={19} />
            <span>პოზიციები</span>
          </button>
          <button className="btn btn-primary add" onClick={openForm}>
            <i>
              <Plus size={26} />
            </i>
            <span>დამატება</span>
          </button>
          <button
            className={`btn btn-ghost ${screen === "analytics" ? "active" : ""}`}
            onClick={() => navigate("analytics")}
          >
            <BarChart3 size={19} />
            <span>ანალიტიკა</span>
          </button>
          <button onClick={() => setMoreOpen(true)} className={`btn btn-ghost ${moreOpen ? "active" : ""}`}>
            <Menu size={19} />
            <span>მეტი</span>
          </button>
        </nav>
      </section>
      {moreOpen && (
        <MoreSheet screen={screen} navigate={navigate} close={() => setMoreOpen(false)} />
      )}
      {modal && (
        <DemoForm
          kind={kind}
          setKind={setKind}
          status={status}
          submit={submit}
          close={() => setModal(false)}
        />
      )}
    </main>
  );
}

function Overview({
  queryAssets,
  openForm,
  navigate,
}: {
  queryAssets: typeof assets;
  openForm: () => void;
  navigate: (screen: Screen) => void;
}) {
  return (
    <>
      <section className="card card-border wallet-balance-card">
        <div className="wallet-balance-copy">
          <div className="wallet-balance-meta">
            <span>კრიპტო კოლექცია</span>
            <button className="btn btn-ghost btn-square" aria-label="თანხის დამალვა">
              <Eye size={16} />
            </button>
          </div>
          <span>პორტფელის ღირებულება</span>
          <strong>$48,215.90</strong>
          <p>
            <b>+2.45%</b>
            <span>+$1,240.50 დღეს</span>
          </p>
          <small>განახლდა ახლახან</small>
        </div>
        <div className="wallet-balance-orbit">
          <i />
          <i />
          <i />
        </div>
        <svg viewBox="0 0 420 150" aria-hidden="true">
          <defs>
            <linearGradient id="hybrid-line">
              <stop stopColor="#54d7ff" />
              <stop offset="1" stopColor="#e96cff" />
            </linearGradient>
          </defs>
          <path
            d="M4 126 C52 120 63 91 103 103 S157 69 194 81 S247 36 285 53 S334 21 416 16"
            fill="none"
            stroke="url(#hybrid-line)"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
      </section>
      <div className="wallet-action-grid">
        <button className="btn btn-primary primary-action" onClick={openForm}>
          <i>
            <Plus size={23} />
          </i>
          <span>დამატება</span>
        </button>
        <button className="btn btn-ghost" onClick={() => navigate("positions")}>
          <i>
            <Wallet size={22} />
          </i>
          <span>პოზიციები</span>
        </button>
        <button className="btn btn-ghost" onClick={() => navigate("allocation")}>
          <i>
            <PieChart size={22} />
          </i>
          <span>განაწილება</span>
        </button>
        <button className="btn btn-ghost" onClick={() => navigate("transactions")}>
          <i>
            <BarChart3 size={22} />
          </i>
          <span>ისტორია</span>
        </button>
      </div>
      <section className="card card-border wallet-liquidity">
        <div>
          <span>ქეში</span>
          <b>$2,310.00</b>
        </div>
        <i />
        <div>
          <span>სტეიბლკოინები</span>
          <b>$2,515.10</b>
        </div>
      </section>
      <section className="card card-border wallet-list-card">
        <header>
          <div>
            <small>აქტივები</small>
            <h2>ძირითადი პოზიციები</h2>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate("positions")}>
            ყველა <ChevronRight size={15} />
          </button>
        </header>
        <div className="wallet-list-body">
          {queryAssets.map((asset, index) => (
            <article key={asset.symbol}>
              <AssetIcon
                symbol={asset.symbol}
                logoUrl={asset.logoUrl}
                index={index}
                size={42}
              />
              <div>
                <strong>{asset.name}</strong>
                <span>
                  {asset.quantity} · {asset.price}
                </span>
              </div>
              <div>
                <strong>{asset.value}</strong>
                <b className={asset.pnl.startsWith("+") ? "gain" : "loss"}>
                  {asset.pnl}
                </b>
              </div>
              <ChevronRight size={16} />
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function History({
  items,
}: {
  items:
    (typeof transactions)[number][] | readonly (typeof transactions)[number][];
}) {
  return (
    <section className="card card-border wallet-history-card">
      <div className="wallet-history-summary">
        <div>
          <small>ამ თვეში</small>
          <strong>12 ტრანზაქცია</strong>
        </div>
        <div>
          <small>წმინდა მოძრაობა</small>
          <strong className="gain">+$2,559.18</strong>
        </div>
      </div>
      <div className="wallet-history-filters">
        <button className="btn btn-sm btn-primary active">ყველა</button>
        <button className="btn btn-sm btn-ghost">შესყიდვა</button>
        <button className="btn btn-sm btn-ghost">გაყიდვა</button>
        <button className="btn btn-sm btn-ghost">შეტანა</button>
      </div>
      {items.map((item) => (
        <article key={`${item.kind}-${item.date}`}>
          <i className={item.direction}>
            {item.direction === "in" ? (
              <ArrowDownLeft size={19} />
            ) : (
              <ArrowUpRight size={19} />
            )}
          </i>
          <div>
            <strong>
              {item.kind} · {item.asset}
            </strong>
            <span>{item.detail}</span>
          </div>
          <div>
            <strong className={item.direction === "in" ? "gain" : "loss"}>
              {item.amount}
            </strong>
            <span>{item.date}</span>
          </div>
        </article>
      ))}
    </section>
  );
}

function FeatureScreen({
  screen,
  queryAssets,
  navigate,
}: {
  screen: Exclude<Screen, "overview" | "transactions">;
  queryAssets: typeof assets;
  navigate: (screen: Screen) => void;
}) {
  if (screen === "positions") {
    return (
      <div className="wallet-feature-stack">
        <MetricStrip
          items={[
            ["აქტივებში", "$43,390.80"],
            ["დღიური P/L", "+$1,240.50", "gain"],
            ["პოზიციები", "6"],
          ]}
        />
        <section className="card card-border wallet-list-card wallet-feature-card">
          <header><div><small>პორტფელი</small><h2>ყველა პოზიცია</h2></div><button className="btn btn-ghost btn-sm" onClick={() => navigate("allocation")}>განაწილება <ChevronRight size={15} /></button></header>
          <div className="wallet-list-body">
            {queryAssets.map((asset, index) => (
              <article key={asset.symbol}>
                <AssetIcon symbol={asset.symbol} logoUrl={asset.logoUrl} index={index} size={42} />
                <div><strong>{asset.name}</strong><span>{asset.quantity} · {asset.price}</span></div>
                <div><strong>{asset.value}</strong><b className={asset.pnl.startsWith("+") ? "gain" : "loss"}>{asset.pnl}</b></div>
                <ChevronRight size={16} />
              </article>
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (screen === "analytics") {
    return <AnalyticsScreen />;
  }
  if (screen === "allocation") {
    return <AllocationScreen />;
  }

  const content: Record<Exclude<Screen, "overview" | "positions" | "transactions" | "analytics" | "allocation">, {
    eyebrow: string;
    title: string;
    description: string;
    rows: Array<[string, string, string, "gain" | "loss" | ""]>;
  }> = {
    airdrops: {
      eyebrow: "მიღებები და აქტივობები", title: "Airdrop ტრეკერი", description: "მოსალოდნელი და მიღებული ჯილდოები ერთ სივრცეში.",
      rows: [["Jupiter", "მიღებული", "$142.86", "gain"], ["LayerZero", "დადასტურებული", "$86.40", "gain"], ["Scroll", "აქტიური", "12 ამოცანა", ""]],
    },
    statistics: {
      eyebrow: "ბაზარი და პორტფელი", title: "მთავარი სტატისტიკა", description: "მაკრო სურათი და თქვენი პორტფელის ჯანმრთელობა.",
      rows: [["ბაზრის განწყობა", "Fear & Greed", "64 · Greed", "gain"], ["BTC დომინაცია", "მაკრო", "52.1%", ""], ["პორტფელის მოგება", "ჩემი პორტფელი", "+18.7%", "gain"], ["მაქს. ვარდნა", "ჩემი პორტფელი", "−12.4%", "loss"]],
    },
    watchlist: {
      eyebrow: "დაკვირვების სია", title: "საინტერესო აქტივები", description: "ფასი და მოძრაობა ზედმეტი მოქმედებების გარეშე.",
      rows: [["Avalanche · AVAX", "$31.17", "+1.11%", "gain"], ["Polygon · POL", "$0.42", "−0.82%", "loss"], ["Arbitrum · ARB", "$0.51", "+2.09%", "gain"], ["Celestia · TIA", "$5.86", "+3.14%", "gain"]],
    },
    strategy: {
      eyebrow: "აქტივის გეგმა", title: "შესვლა და გასვლა", description: "ერთიანი გეგმა თითოეული აქტივისთვის.",
      rows: [["Bitcoin", "შესვლა: $39k–$41k", "გასვლა: $58k", ""], ["Ethereum", "შესვლა: $2.1k", "გასვლა: $3.4k", ""], ["Solana", "DCA ყოველ თვე", "სამიზნე: $210", ""]],
    },
    scenarios: {
      eyebrow: "რა მოხდება თუ", title: "პორტფელის სცენარები", description: "შედეგები ფასების შესაძლო მოძრაობისას.",
      rows: [["კონსერვატიული", "BTC +10% · ETH +8%", "$52,406", "gain"], ["საბაზისო", "მიმდინარე ფასები", "$48,216", ""], ["სტრეს ტესტი", "ბაზარი −20%", "$38,573", "loss"]],
    },
    journal: {
      eyebrow: "საინვესტიციო ჩანაწერები", title: "ჟურნალი", description: "გადაწყვეტილებები, თეზისები და შემდგომი შეფასება.",
      rows: [["BTC — ციკლის თეზისი", "განახლდა დღეს", "აქტიური", "gain"], ["SOL — რისკის შეფასება", "28 სექტემბერი", "გადასახედი", ""], ["კვირის მიმოხილვა", "22 სექტემბერი", "დასრულებული", ""]],
    },
    settings: {
      eyebrow: "ანგარიში", title: "პორტფელის პარამეტრები", description: "სახელი, ვალუტა, კონფიდენციალურობა და შეტყობინებები.",
      rows: [["პორტფელის სახელი", "Crypto Collective", "შეცვლა", ""], ["საბაზისო ვალუტა", "USD", "აშშ დოლარი", ""], ["თანხების კონფიდენციალურობა", "გამორთული", "მართვა", ""], ["ფასების შეტყობინებები", "ჩართული", "მართვა", "gain"]],
    },
  };
  const page = content[screen];
  return (
    <div className="wallet-feature-stack">
      <section className="card card-border wallet-feature-intro">
        <small>{page.eyebrow}</small>
        <h2>{page.title}</h2>
        <p>{page.description}</p>
      </section>
      <section className="card card-border wallet-feature-card wallet-simple-list">
        {page.rows.map(([name, meta, value, tone]) => (
          <article key={name}>
            <i><ChevronRight size={17} /></i>
            <div><strong>{name}</strong><span>{meta}</span></div>
            <b className={tone}>{value}</b>
          </article>
        ))}
      </section>
    </div>
  );
}

function MetricStrip({ items }: { items: Array<[string, string, string?]> }) {
  return <section className="wallet-metric-strip">{items.map(([label, value, tone]) => <div key={label}><span>{label}</span><strong className={tone}>{value}</strong></div>)}</section>;
}

function AnalyticsScreen() {
  return (
    <div className="wallet-feature-stack">
      <MetricStrip items={[["მთლიანი P/L", "+$8,904", "gain"], ["ROI", "+18.7%", "gain"], ["რეალიზებული", "$1,840"]]} />
      <section className="card card-border wallet-chart-card">
        <header><div><small>პორტფელის დინამიკა</small><h2>ღირებულება დროში</h2></div><span>1 წელი</span></header>
        <div className="wallet-chart-visual"><span>$48.2k</span><svg viewBox="0 0 600 190" preserveAspectRatio="none"><path d="M0 154 C65 151 79 120 132 130 S207 77 265 101 S342 62 407 74 S486 25 600 35" /></svg></div>
      </section>
      <section className="card card-border wallet-feature-card wallet-simple-list">
        <article><i><TrendingUp size={17} /></i><div><strong>საუკეთესო შედეგი</strong><span>Solana</span></div><b className="gain">+42.8%</b></article>
        <article><i><ShieldCheck size={17} /></i><div><strong>ლიკვიდობა</strong><span>ქეში და სტეიბლკოინები</span></div><b>10.0%</b></article>
      </section>
    </div>
  );
}

function AllocationScreen() {
  return (
    <div className="wallet-feature-stack wallet-allocation-layout">
      <section className="card card-border wallet-donut-card"><div className="wallet-donut"><span><b>$48.2k</b><small>სულ</small></span></div><div><small>კონცენტრაცია</small><strong>Top 3 · 63%</strong><p>ლიკვიდობა ცალკეა: $4,825</p></div></section>
      <section className="card card-border wallet-feature-card wallet-simple-list">
        {assets.slice(0, 5).map((asset, index) => <article key={asset.symbol}><AssetIcon symbol={asset.symbol} logoUrl={asset.logoUrl} index={index} size={38} /><div><strong>{asset.name}</strong><span>{asset.value}</span></div><b>{["38.2%", "19.3%", "12.4%", "8.1%", "6.4%"][index]}</b></article>)}
      </section>
    </div>
  );
}

function MoreSheet({ screen, navigate, close }: { screen: Screen; navigate: (screen: Screen) => void; close: () => void }) {
  const groups = ["პორტფელი", "კვლევა", "დაგეგმვა", "ანგარიში"] as const;
  return (
    <div className="wallet-more-backdrop" onMouseDown={(event) => event.currentTarget === event.target && close()}>
      <section className="modal-box card card-border wallet-more-sheet">
        <header><div><small>ნავიგაცია</small><h2>ყველა განყოფილება</h2></div><button className="btn btn-ghost btn-square" onClick={close} aria-label="დახურვა"><X size={20} /></button></header>
        {groups.map((group) => <div className="wallet-more-group" key={group}><span>{group}</span><div>{navigation.filter((item) => item.group === group).map((item) => { const Icon = item.icon; return <button key={item.screen} className={`btn btn-ghost justify-start ${screen === item.screen ? "active" : ""}`} onClick={() => navigate(item.screen)}><Icon size={18} /><span>{item.label}</span></button>; })}</div></div>)}
      </section>
    </div>
  );
}

function DemoForm({
  kind,
  setKind,
  status,
  submit,
  close,
}: {
  kind: string;
  setKind: (x: string) => void;
  status: "idle" | "loading" | "success";
  submit: (e: React.FormEvent) => void;
  close: () => void;
}) {
  return (
    <div
      className="wallet-demo-modal"
      role="presentation"
      onMouseDown={(e) => {
        if (e.currentTarget === e.target) close();
      }}
    >
      <section
        className="modal-box card card-border"
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-form-title"
      >
        <header>
          <div>
            <small>პორტფელის განახლება</small>
            <h2 id="demo-form-title">ტრანზაქციის დამატება</h2>
          </div>
          <button className="btn btn-ghost btn-square" onClick={close} aria-label="დახურვა">
            <X size={20} />
          </button>
        </header>
        {status === "success" ? (
          <div className="wallet-demo-success">
            <i>
              <Check size={28} />
            </i>
            <h3>ტრანზაქცია მზად არის</h3>
            <p>ეს დემო რეჟიმია — მონაცემები არ შენახულა.</p>
            <button className="btn btn-primary wallet-hybrid-primary" onClick={close}>
              დახურვა
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="wallet-kind-grid">
              {kinds.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={`btn btn-sm btn-ghost ${kind === item ? "active" : ""}`}
                  onClick={() => setKind(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="wallet-form-grid">
              <label>
                <span>აქტივი</span>
                <select className="select select-bordered" defaultValue="bitcoin">
                  <option value="bitcoin">BTC · Bitcoin</option>
                  <option value="ethereum">ETH · Ethereum</option>
                  <option value="solana">SOL · Solana</option>
                </select>
              </label>
              <label>
                <span>რაოდენობა</span>
                <input className="input input-bordered" inputMode="decimal" placeholder="0.00" required />
              </label>
              <label>
                <span>ერთეულის ფასი (USD)</span>
                <input className="input input-bordered" inputMode="decimal" placeholder="0.00" required />
              </label>
              <label>
                <span>საკომისიო (USD)</span>
                <input className="input input-bordered" inputMode="decimal" defaultValue="0" />
              </label>
              <label>
                <span>თარიღი და დრო</span>
                <input
                  className="input input-bordered"
                  type="datetime-local"
                  defaultValue="2026-10-01T14:32"
                  required
                />
              </label>
              <label className="wide">
                <span>შენიშვნა</span>
                <textarea className="textarea textarea-bordered" placeholder="სურვილისამებრ" />
              </label>
            </div>
            <div className="wallet-form-actions">
              <button className="btn btn-ghost" type="button" onClick={close}>
                გაუქმება
              </button>
              <button
                className="btn btn-primary wallet-hybrid-primary"
                disabled={status === "loading"}
              >
                {status === "loading" ? "მზადდება…" : "ტრანზაქციის დამატება"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
