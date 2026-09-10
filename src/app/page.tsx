import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  Layers3,
  ChartNoAxesCombined,
  ShieldCheck,
} from "lucide-react";
import { Brand } from "@/components/brand";

export default function Home() {
  return (
    <div className="mx-auto max-w-7xl px-6 sm:px-12">
      <header className="flex items-center justify-between border-b border-line py-7">
        <Brand />
        <Link className="button-secondary" href="/login">
          შესვლა <ArrowUpRight size={15} />
        </Link>
      </header>
      <main id="main">
        <section className="grid items-center gap-14 py-20 lg:grid-cols-[1.1fr_1fr] lg:py-32">
          <div>
            <p className="mb-7 flex items-center gap-2 text-xs text-brand">
              <span className="size-1.5 rounded-full bg-brand" />
              თქვენი პორტფელის სრული სურათი
            </p>
            <h1 className="max-w-2xl text-4xl font-semibold leading-[1.5] tracking-tight sm:text-5xl">
              ინვესტიციები.
              <br />
              გააზრებული
              <br />
              <span className="text-brand">გადაწყვეტილებები.</span>
            </h1>
            <p className="mt-7 max-w-md text-sm leading-8 text-muted">
              იცოდეთ, რას ფლობთ და საით მიდიხართ. მართეთ კრიპტოპორტფელი,
              შეაფასეთ შედეგები და დაგეგმეთ შემდეგი ნაბიჯი ერთ სივრცეში.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link className="button-primary" href="/login">
                პორტფელის შექმნა <ArrowRight size={16} />
              </Link>
              <Link className="button-secondary" href="/preview">
                დიზაინის ნახვა <ArrowUpRight size={16} />
              </Link>
            </div>
            <p className="mt-5 text-[11px] text-muted">
              ქართულენოვანი სამუშაო სივრცე · თქვენი მონაცემები, თქვენი კონტროლი
            </p>
          </div>
          <div className="relative">
            <div className="absolute -inset-8 -z-10 rounded-full bg-brand/5 blur-3xl" />
            <div className="panel overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-6 py-4">
                <span className="text-[11px] text-muted">
                  პორტფელის მიმოხილვა
                </span>
                <span className="text-[10px] text-brand">
                  საილუსტრაციო ვიზუალი
                </span>
              </div>
              <div className="p-7">
                <p className="text-xs text-muted">თქვენი სტრატეგია იწყება აქ</p>
                <div className="my-6 flex gap-2">
                  <span className="h-11 w-32 rounded-lg bg-brand/15" />
                  <span className="h-11 w-16 rounded-lg bg-raised" />
                </div>
                <svg
                  viewBox="0 0 400 140"
                  role="img"
                  aria-label="პორტფელის გრაფიკის საილუსტრაციო ფორმა, რეალური მონაცემების გარეშე"
                  className="my-8 w-full"
                >
                  <defs>
                    <linearGradient id="hero-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop stopColor="#aa91ff" stopOpacity=".2" />
                      <stop offset="1" stopColor="#aa91ff" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[30, 70, 110].map((y) => (
                    <path
                      key={y}
                      d={`M0 ${y}H400`}
                      stroke="#2b2d38"
                      strokeDasharray="3 5"
                    />
                  ))}
                  <path
                    d="M0 112L30 102L54 110L81 85L112 92L147 65L176 76L200 49L232 59L264 31L298 45L326 21L353 31L400 7V140H0Z"
                    fill="url(#hero-fill)"
                  />
                  <path
                    d="M0 112L30 102L54 110L81 85L112 92L147 65L176 76L200 49L232 59L264 31L298 45L326 21L353 31L400 7"
                    fill="none"
                    stroke="#aa91ff"
                    strokeWidth="2"
                  />
                </svg>
                <div className="grid grid-cols-3 gap-3 border-t border-line pt-5">
                  {["პოზიციები", "ანალიტიკა", "სტრატეგია"].map((t) => (
                    <div key={t}>
                      <span className="text-[10px] text-muted">{t}</span>
                      <div className="mt-3 h-1.5 w-14 rounded-full bg-brand/25" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="grid gap-8 border-t border-line py-10 md:grid-cols-3">
          {[
            [
              Layers3,
              "ერთი სანდო საფუძველი",
              "ტრანზაქციები, პოზიციები და გამოთვლები ერთმანეთთანაა დაკავშირებული.",
            ],
            [
              ChartNoAxesCombined,
              "მონაცემებიდან გეგმამდე",
              "შეაფასეთ პორტფელი და გამოცადეთ საინვესტიციო სცენარები.",
            ],
            [
              ShieldCheck,
              "პირადი სამუშაო სივრცე",
              "თქვენი პორტფელის მონაცემებზე წვდომა მხოლოდ თქვენ გაქვთ.",
            ],
          ].map(([Icon, title, text]) => {
            const Component = Icon as typeof Layers3;
            return (
              <div key={String(title)}>
                <Component size={21} className="mb-4 text-brand" />
                <h2 className="text-sm font-medium">{String(title)}</h2>
                <p className="mt-3 text-xs leading-7 text-muted">
                  {String(text)}
                </p>
              </div>
            );
          })}
        </section>
      </main>
      <footer className="border-t border-line py-6 text-[11px] text-muted">
        © {new Date().getFullYear()} Crypto Collective X
      </footer>
    </div>
  );
}
