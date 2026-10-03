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
    <div className="mx-auto max-w-6xl px-4 lg:px-5">
      <header className="flex items-center justify-between border-b border-base-300 py-4">
        <Brand />
        <Link className="btn btn-ghost" href="/login">
          შესვლა <ArrowUpRight size={15} />
        </Link>
      </header>
      <main id="main">
        <section className="grid items-center gap-6 py-8 lg:grid-cols-2 lg:py-12">
          <div>
            <p className="mb-3 flex items-center gap-2 text-xs text-primary">
              <span className="size-1.5 rounded-full bg-primary" />
              თქვენი პორტფელის სრული სურათი
            </p>
            <h1 className="max-w-2xl text-3xl font-semibold leading-snug tracking-tight lg:text-4xl">
              ინვესტიციები.
              <br />
              გააზრებული
              <br />
              <span className="text-primary">გადაწყვეტილებები.</span>
            </h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-base-content/60">
              იცოდეთ, რას ფლობთ და საით მიდიხართ. მართეთ კრიპტოპორტფელი,
              შეაფასეთ შედეგები და დაგეგმეთ შემდეგი ნაბიჯი ერთ სივრცეში.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link className="btn btn-primary" href="/login">
                პორტფელის შექმნა <ArrowRight size={16} />
              </Link>
            </div>
            <p className="mt-5 text-[11px] text-base-content/60">
              ქართულენოვანი სამუშაო სივრცე · თქვენი მონაცემები, თქვენი კონტროლი
            </p>
          </div>
          <div className="min-w-0">
            <div className="card card-border bg-base-200">
              <div className="flex items-center justify-between border-b border-base-300 px-6 py-4">
                <span className="text-[11px] text-base-content/60">
                  პორტფელის მიმოხილვა
                </span>
                <span className="text-[10px] text-primary">
                  საილუსტრაციო ვიზუალი
                </span>
              </div>
              <div className="p-4">
                <p className="text-xs text-base-content/60">
                  თქვენი სტრატეგია იწყება აქ
                </p>
                <div className="my-6 flex gap-2">
                  <span className="h-11 w-32 rounded-lg bg-primary/15" />
                  <span className="h-11 w-16 rounded-lg bg-base-300" />
                </div>
                <svg
                  viewBox="0 0 400 140"
                  role="img"
                  aria-label="პორტფელის გრაფიკის საილუსტრაციო ფორმა, რეალური მონაცემების გარეშე"
                  className="my-4 w-full"
                >
                  <defs>
                    <linearGradient id="hero-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop stopColor="var(--color-primary)" stopOpacity=".2" />
                      <stop
                        offset="1"
                        stopColor="var(--color-primary)"
                        stopOpacity="0"
                      />
                    </linearGradient>
                  </defs>
                  {[30, 70, 110].map((y) => (
                    <path
                      key={y}
                      d={`M0 ${y}H400`}
                      stroke="var(--color-base-300)"
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
                    stroke="var(--color-primary)"
                    strokeWidth="2"
                  />
                </svg>
                <div className="grid grid-cols-3 gap-3 border-t border-base-300 pt-5">
                  {["პოზიციები", "ანალიტიკა", "სტრატეგია"].map((t) => (
                    <div key={t}>
                      <span className="text-[10px] text-base-content/60">
                        {t}
                      </span>
                      <div className="mt-3 h-1.5 w-14 rounded-full bg-primary/25" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="grid gap-3 pb-8 md:grid-cols-3 lg:gap-4">
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
              <div
                key={String(title)}
                className="card card-border bg-base-200 p-4"
              >
                <Component size={21} className="mb-4 text-primary" />
                <h2 className="text-sm font-medium">{String(title)}</h2>
                <p className="mt-3 text-xs leading-7 text-base-content/60">
                  {String(text)}
                </p>
              </div>
            );
          })}
        </section>
      </main>
      <footer className="border-t border-base-300 py-6 text-[11px] text-base-content/60">
        © {new Date().getFullYear()} Crypto Collective X
      </footer>
    </div>
  );
}
