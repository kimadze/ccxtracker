import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import type { PortfolioSummary } from "@/domain/types";
import { decimal, percent } from "@/domain/decimal";
import { dateTime, money, percentage, pnlClass } from "@/lib/formatters";
import { AssetIcon } from "./positions";
import { BalanceValue } from "./ui";

export function Overview({ summary: s, base, portfolioName, cryptoOnlyValue = false, history, action }: {
  summary: PortfolioSummary; base: string; portfolioName: string; cryptoOnlyValue?: boolean; history?: ReactNode; action?: ReactNode;
}) {
  const positions = [...s.positions].sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0));
  const crypto = positions.filter((p) => !p.asset.isStablecoin && Number(p.value ?? 0) > 0);
  const cryptoTotal = crypto.reduce((sum, p) => sum.plus(p.value ?? 0), decimal(0));
  const displayedValue = cryptoOnlyValue ? cryptoTotal.toString() : (s.value ?? s.knownValue);
  const liquidityShare = s.value && s.liquidity !== null ? percent(s.liquidity, s.value) : null;
  const netCapital = s.contributions !== null && s.withdrawals !== null ? decimal(s.contributions).minus(s.withdrawals).toString() : null;
  const updatedAt = positions.map((p) => p.quote?.updatedAt).filter((d): d is string => Boolean(d)).sort().at(-1);
  const freshness = !positions.length ? "აქტივები ჯერ არ არის" : s.stale ? "ფასები დაგვიანებულია" : s.complete ? "ფასები განახლებულია" : "ფასები არასრულია";
  const palette = ["bg-primary", "bg-info", "bg-accent", "bg-warning", "bg-secondary"];
  const segments = crypto.slice(0, 4).map((p, i) => ({
    label: p.asset.symbol, color: palette[i],
    share: cryptoTotal.gt(0) ? Number(percent(p.value ?? "0", cryptoTotal.toString()) ?? 0) : 0,
  }));
  if (crypto.length > 4) segments.push({ label: "სხვა", color: palette[4], share: Math.max(0, 100 - segments.reduce((sum, p) => sum + p.share, 0)) });
  const secondary = <>
    <Metric label="წმინდა კაპიტალი" value={money(netCapital)} hint="შეტანები − გატანები" sensitive />
    <Metric label="რეალიზებული P/L" value={money(s.realizedPnl)} tone={pnlClass(s.realizedPnl)} sensitive />
    <Metric label="არარეალიზებული P/L" value={money(s.unrealizedPnl)} tone={pnlClass(s.unrealizedPnl)} sensitive />
    <Metric label="აქტიური პოზიციები" value={String(positions.length)} />
  </>;

  return <div className="mx-auto w-full min-w-0 max-w-7xl space-y-5">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-xs text-base-content/50">{portfolioName}</p>
        <h1 className="mt-1 text-xl font-semibold sm:text-2xl">პორტფელის მიმოხილვა</h1>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-base-content/60">
          <span className={`status status-xs ${s.complete && !s.stale ? "status-success" : "status-warning"}`} />
          {freshness}{updatedAt && <span>· {dateTime(updatedAt)}</span>}
        </p>
      </div>
      <div className="shrink-0 [&>button]:min-h-11 [&>button]:w-full sm:[&>button]:w-auto">{action}</div>
    </header>

    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(17rem,1fr)]">
      <section className="min-w-0 space-y-4" aria-label="ღირებულება და ისტორია">
        <div className="hover-3d w-full min-w-0 [@media(hover:none)]:pointer-events-none motion-reduce:pointer-events-none [&>:first-child]:scale-100! [@media(hover:none)]:[&>:first-child]:transform-none! motion-reduce:[&>:first-child]:transform-none! motion-reduce:[&>:first-child]:transition-none!">
          <div className="card card-border w-full min-w-0 bg-base-200">
            <div className="card-body gap-3 p-5 sm:p-6">
              <h2 className="text-sm text-base-content/65">{cryptoOnlyValue ? "კრიპტოაქტივების ღირებულება" : "პორტფელის ღირებულება"}</h2>
              <p className="break-all text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl"><BalanceValue>{money(displayedValue)}</BalanceValue></p>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className={`text-base font-semibold tabular-nums ${pnlClass(s.totalPnl)}`}><BalanceValue>{s.totalPnl !== null && decimal(s.totalPnl).gt(0) ? "+" : ""}{money(s.totalPnl)}</BalanceValue></span>
                <span className="text-xs text-base-content/50">მთლიანი P/L</span>
              </div>
              <p className="text-xs text-base-content/45">{cryptoOnlyValue ? "ნაღდი ფულისა და სტეიბლკოინების გარეშე" : "კრიპტოაქტივები და ლიკვიდობა"}</p>
              {!s.complete && <p role="status" className="text-xs text-warning">შეფასება ნაწილობრივია — ზოგი აქტივის ფასი მიუწვდომელია.</p>}
            </div>
          </div>
          <div aria-hidden="true" /><div aria-hidden="true" /><div aria-hidden="true" /><div aria-hidden="true" /><div aria-hidden="true" /><div aria-hidden="true" /><div aria-hidden="true" /><div aria-hidden="true" />
        </div>
        <div className="card card-border min-w-0 bg-base-200">
          <div className="card-body min-w-0 gap-4 p-4 sm:p-6">
            <h2 className="text-sm font-semibold">ღირებულების ისტორია</h2>
            {history ?? <p className="py-4 text-sm text-base-content/55">ისტორიისთვის საჭიროა მინიმუმ ორი შეფასება.</p>}
          </div>
        </div>
      </section>

      <aside className="min-w-0 space-y-4">
        <section className="card card-border bg-base-200">
          <div className="card-body gap-3 p-5">
            <h2 className="text-sm font-semibold">ლიკვიდობა</h2>
            <p className="break-all text-2xl font-semibold tabular-nums"><BalanceValue>{money(s.liquidity)}</BalanceValue></p>
            <p className="text-xs text-base-content/50">პორტფელის {percentage(liquidityShare)}</p>
            <progress className="progress h-1.5 w-full" value={Number(liquidityShare ?? 0)} max="100" aria-label="ლიკვიდობის წილი" />
            <dl className="space-y-3 border-t border-base-300 pt-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2"><dt className="text-base-content/55">ნაღდი ფული</dt><dd><BalanceValue>{money(s.cash)}</BalanceValue></dd></div>
              <div className="flex flex-wrap justify-between gap-2"><dt className="text-base-content/55">სტეიბლკოინები</dt><dd><BalanceValue>{money(s.stablecoinValue)}</BalanceValue></dd></div>
            </dl>
            {liquidityShare !== null && Number(liquidityShare) < 10 && <p className="text-xs text-base-content/55">ლიკვიდობის წილი 10%-ზე ნაკლებია.</p>}
          </div>
        </section>
        <section className="card card-border bg-base-200">
          <div className="card-body gap-3 p-5">
            <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">კრიპტო განაწილება</h2><Link href={`${base}/allocation`} className="btn btn-ghost btn-square min-h-11 min-w-11" aria-label="განაწილების ნახვა"><ArrowUpRight size={18} /></Link></div>
            {segments.length ? <>
              <div className="flex h-2 overflow-hidden rounded-full bg-base-300">{segments.map((p) => <span key={p.label} className={p.color} style={{ width: `${p.share}%` }} />)}</div>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">{segments.map((p) => <span key={p.label} className="flex items-center gap-1.5"><span className={`size-2 rounded-full ${p.color}`} />{p.label}<span className="text-base-content/50">{percentage(String(p.share))}</span></span>)}</div>
              {segments[0].share >= 35 && <p className="text-xs text-base-content/55">{segments[0].label} კრიპტოაქტივების უდიდესი წილია.</p>}
            </> : <p className="text-sm text-base-content/55">კრიპტოაქტივები ჯერ არ არის.</p>}
            <p className="text-xs text-base-content/40">ლიკვიდობის გარეშე</p>
          </div>
        </section>
      </aside>
    </div>

    <section className="card card-border bg-base-200">
      <div className="card-body gap-0 p-4 sm:p-6">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold">თქვენი აქტივები</h2><Link href={`${base}/positions`} className="btn btn-ghost min-h-11">ყველა პოზიცია <ArrowUpRight size={16} /></Link></div>
        <ul className="list">{positions.slice(0, 6).map((p, i) => <li key={p.assetId} className="border-b border-base-300 last:border-0">
          <Link href={`${base}/positions/${p.assetId}`} className="flex min-h-20 items-center gap-3 rounded-field py-3 transition-colors hover:bg-base-300/40 focus-visible:outline-2 focus-visible:outline-primary">
            <AssetIcon symbol={p.asset.symbol} logoUrl={p.asset.logoUrl} index={i} />
            <div className="min-w-0 flex-1"><p className="font-semibold">{p.asset.symbol}</p><p className="truncate text-xs text-base-content/50">{p.asset.name}</p></div>
            <div className="min-w-0 max-w-[60%] text-right tabular-nums"><p className="break-all font-semibold"><BalanceValue>{money(p.value)}</BalanceValue></p><p className={`mt-1 text-xs ${pnlClass(p.returnPercent)}`}>{percentage(p.returnPercent, true)}</p></div>
          </Link>
        </li>)}</ul>
        {!positions.length && <p className="py-6 text-sm text-base-content/55">პოზიციები ჯერ არ არის. დასაწყებად დაამატეთ ტრანზაქცია.</p>}
      </div>
    </section>
    <details className="collapse collapse-arrow border border-base-300 bg-base-200 md:hidden">
      <summary className="collapse-title min-h-11 text-sm font-medium">დამატებითი მაჩვენებლები</summary>
      <div className="collapse-content"><div className="stats stats-vertical w-full bg-transparent">{secondary}</div></div>
    </details>
    <section aria-label="დამატებითი მაჩვენებლები" className="hidden min-w-0 rounded-box border border-base-300 bg-base-200 md:grid md:grid-cols-2 xl:grid-cols-4">{secondary}</section>
  </div>;
}

export function Metric({ label, value, hint, tone = "", sensitive = false }: { label: string; value: string; hint?: string; tone?: string; sensitive?: boolean }) {
  return <div className="stat min-w-0"><div className="stat-title whitespace-normal" title={hint}>{label}</div><div className={`stat-value break-all whitespace-normal text-2xl ${tone}`}>{sensitive ? <BalanceValue>{value}</BalanceValue> : value}</div>{hint && <div className="stat-desc whitespace-normal">{hint}</div>}</div>;
}
