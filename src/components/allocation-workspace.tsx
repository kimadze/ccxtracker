"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Save, SlidersHorizontal } from "lucide-react";
import type { Asset, PortfolioSummary, Quote } from "@/domain/types";
import { calculateDeployment, validateWeights } from "@/domain/allocation";
import { decimal } from "@/domain/decimal";
import { isInvestableCrypto, investableAllocation, investablePositions, investableValue } from "@/domain/portfolio-segments";
import { inputNumber, money, percentage, pnlClass } from "@/lib/formatters";
import { saveAllocation } from "@/server/allocation-actions";
import { AssetIcon } from "./positions";
import { Message } from "./ui";
import { TransactionForm } from "./transaction-form";

export function AllocationWorkspace({ summary, assets, quotes, portfolioId, revision, initial, preview = false }: {
  summary: PortfolioSummary; assets: Asset[]; quotes: Quote[]; portfolioId: string; revision: number; initial: { assetId: string; weight: string }[]; preview?: boolean;
}) {
  const cryptoAssets = useMemo(() => assets.filter(isInvestableCrypto), [assets]);
  const cryptoPositions = useMemo(() => investablePositions(summary), [summary]);
  const ids = useMemo(() => [...new Set([...cryptoPositions.map((p) => p.assetId), ...initial.filter((r) => cryptoAssets.some((asset) => asset.id === r.assetId)).map((r) => r.assetId)])], [cryptoPositions, initial, cryptoAssets]);
  const [weights, setWeights] = useState<Record<string, string>>(() => Object.fromEntries(ids.map((id) => [id, initial.find((r) => r.assetId === id)?.weight ?? "0"])));
  const [capital, setCapital] = useState(""), [mode, setMode] = useState<"target" | "custom">("target"), [custom, setCustom] = useState<Record<string, string>>({}), [addId, setAddId] = useState(""), [message, setMessage] = useState(""), [error, setError] = useState(false), [pending, setPending] = useState(false);
  const asset = (id: string) => assets.find((a) => a.id === id);
  const symbol = (id: string) => id === "USD" ? "USD" : asset(id)?.symbol ?? id;
  const displayNumber = (value: string) => value === "" ? "" : inputNumber(value);
  const rows = Object.entries(weights).map(([assetId, weight]) => ({ assetId, weight: weight || "0", value: cryptoPositions.find((p) => p.assetId === assetId)?.value ?? "0", price: quotes.find((q) => q.assetId === assetId)?.price ?? null }));
  const total = rows.reduce((sum, row) => sum.plus(row.weight), decimal(0));
  let valid = false; let result: ReturnType<typeof calculateDeployment> | null = null;
  try { validateWeights(rows); valid = true; if (summary.complete && capital !== "") result = calculateDeployment(rows, capital, mode === "custom" ? custom : undefined); } catch { /* an editable draft is valid UI state */ }
  const cryptoValue = investableValue(summary);
  const currentWeight = (id: string) => investableAllocation(cryptoPositions.find((p) => p.assetId === id)?.value ?? null, cryptoValue);
  const save = async () => { setPending(true); try { const response = await saveAllocation({ portfolioId, rows: rows.map(({ assetId, weight }) => ({ assetId, weight })) }); setError(!response.ok); setMessage(response.ok ? "განაწილება შენახულია." : response.error); } catch { setError(true); setMessage("შენახვა ვერ მოხერხდა."); } finally { setPending(false); } };

  return <div className="allocation-ledger">
    <section className="allocation-ribbon" aria-label="მიზნობრივი განაწილება">
      <div className="allocation-ribbon-title"><span>კრიპტოაქტივების განაწილება</span><small>{valid ? "მიზნები მზადაა" : "წონები უნდა უდრიდეს 100%-ს"}</small></div>
      <div className="allocation-ribbon-stats"><span><small>სულ წილი</small><strong>{inputNumber(total.toFixed())}%</strong></span><span><small>აქტიური კრიპტო</small><strong>{cryptoPositions.length}</strong></span></div>
      <div className="allocation-ribbon-bar">{rows.filter((row) => decimal(row.weight).gt(0)).map((row, index) => <span key={row.assetId} style={{ flexGrow: Number(row.weight), opacity: Math.max(.45, 1 - index * .045) }}><b>{symbol(row.assetId)}</b><small>{inputNumber(row.weight)}%</small></span>)}</div>
    </section>

    <div className="allocation-ledger-grid">
      <section className="panel allocation-ledger-table">
        <header><div><p className="allocation-kicker"><SlidersHorizontal size={13} /> ალოკაციის ქენვისი</p><h2>მიზნობრივი განაწილება</h2></div><button className="button-secondary" onClick={() => setMessage("შეიყვანეთ თითო აქტივის სამიზნე წილი და შეინახეთ.")}>რედაქტირება</button></header>
        <div className="allocation-ledger-head"><span>აქტივი</span><span>სამიზნე წილი</span><span>მიმდინარე წილი</span><span>გადახრა</span><span>ღირებულება</span></div>
        <div className="allocation-ledger-rows">{rows.map((row, index) => { const current = currentWeight(row.assetId); const deviation = current === null ? null : decimal(current).minus(row.weight).toFixed(); return <div className="allocation-ledger-row" key={row.assetId}>
          <Link className="allocation-ledger-asset" href={`/portfolios/${portfolioId}/strategy?asset=${encodeURIComponent(row.assetId)}`}><AssetIcon symbol={symbol(row.assetId)} logoUrl={asset(row.assetId)?.logoUrl} index={index} /><span><strong>{symbol(row.assetId)}</strong><small>{asset(row.assetId)?.name} · გეგმის გახსნა ↗</small></span></Link>
          <label className="allocation-ledger-input"><input aria-label={`${symbol(row.assetId)} სამიზნე წილი`} inputMode="decimal" value={displayNumber(row.weight)} onChange={(event) => { setWeights((w) => ({ ...w, [row.assetId]: event.target.value })); setMessage(""); }} /><span>%</span></label>
          <span>{percentage(current)}</span><span className={pnlClass(deviation)}>{percentage(deviation, true)}</span><strong>{money(row.value)}</strong>
        </div>; })}</div>
        <footer><select aria-label="აქტივის დამატება" value={addId} onChange={(event) => setAddId(event.target.value)}><option value="">აქტივის დამატება…</option>{cryptoAssets.filter((item) => !(item.id in weights)).map((item) => <option value={item.id} key={item.id}>{item.symbol} · {item.name}</option>)}</select><button className="button-secondary" disabled={!addId} onClick={() => { setWeights((w) => ({ ...w, [addId]: "0" })); setAddId(""); }}><Plus size={14} /> დამატება</button>{!preview && <button className="button-primary" disabled={!valid || pending} onClick={save}><Save size={14} />{pending ? "ინახება…" : "შენახვა"}</button>}</footer>
      </section>

      <aside className="allocation-ledger-side">
        <section className="panel concentration-card"><header><h2>კონცენტრაცია</h2><span>არასტეიბლ კრიპტო</span></header>{[1, 3, 5, 10].map((count) => { const value = [...rows].sort((a,b) => Number(b.value) - Number(a.value)).slice(0, count).reduce((sum,row) => sum.plus(row.value), decimal(0)); const share = cryptoValue ? value.div(cryptoValue).mul(100).toFixed() : "0"; return <div key={count}><span>Top {count}</span><i><b style={{ width: `${Math.min(100, Number(share))}%` }} /></i><strong>{percentage(share)}</strong></div>; })}</section>
        <section className="panel rebalance-card"><header><div><p className="allocation-kicker">Rebalance</p><h2>ახალი კაპიტალი</h2></div><select aria-label="განაწილების რეჟიმი" value={mode} onChange={(event) => setMode(event.target.value as "target" | "custom")}><option value="target">მიზნობრივი</option><option value="custom">ხელით</option></select></header><label><span>დასამატებელი თანხა</span><div><b>$</b><input inputMode="decimal" value={capital} placeholder="0" onChange={(event) => setCapital(event.target.value)} /></div></label>{mode === "custom" && <div className="custom-allocation-inputs">{rows.map((row) => <label key={row.assetId}><span>{symbol(row.assetId)}</span><input aria-label={`${symbol(row.assetId)} თანხა`} inputMode="decimal" value={custom[row.assetId] ?? ""} placeholder="0" onChange={(event) => setCustom((values) => ({ ...values, [row.assetId]: event.target.value }))} /></label>)}</div>}{result ? <div className="rebalance-actions"><p>რეკომენდებული შესყიდვები</p>{result.rows.filter((row) => decimal(row.capital).gt(0)).slice(0,5).map((row, index) => <div key={row.assetId}><span className="allocation-ledger-asset"><AssetIcon symbol={symbol(row.assetId)} logoUrl={asset(row.assetId)?.logoUrl} index={index} /><strong>{symbol(row.assetId)}</strong></span><strong className="text-brand">{money(row.capital)}</strong>{!preview && <TransactionForm portfolioId={portfolioId} revision={revision} assets={assets} initialAsset={row.assetId} triggerLabel="ყიდვა" />}</div>)}</div> : <p className="rebalance-empty">{mode === "custom" ? "შეავსეთ ხელით გასანაწილებელი თანხები; მათი ჯამი ახალ კაპიტალს უნდა დაემთხვეს." : "შეიყვანეთ თანხა, რომ გამოჩნდეს მიზნობრივ წონებამდე საჭირო შესყიდვები."}</p>}</section>
      </aside>
    </div>
    {message && <Message error={error}>{message}</Message>}
  </div>;
}
