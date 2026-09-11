"use client";
import { useState } from "react";
import type { MacroStatistics, MacroEvent } from "@/domain/statistics";
import { dateTime, percentage, quantity } from "@/lib/formatters";

function localDay(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tbilisi", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const part = (name: string) => parts.find(item => item.type === name)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
const eventDay = (event: MacroEvent) => event.dateOnly ? event.startsAt.slice(0, 10) : localDay(event.startsAt);

export function MacroCalendar({ data }: { data: MacroStatistics }) {
  const [period, setPeriod] = useState("all");
  const [category, setCategory] = useState("all");
  const [highOnly, setHighOnly] = useState(false);
  const today = localDay(data.fetchedAt);
  const events = data.events.filter((event) => {
    const day = eventDay(event);
    const days = (Date.parse(day) - Date.parse(today)) / 86400000;
    return (period === "past" ? days < 0 : days >= 0)
      && (period !== "today" || days === 0)
      && (period !== "week" || days < 7)
      && (category === "all" || event.category === category)
      && (!highOnly || event.impact === "high");
  });
  const next = data.events.find(event => (event.dateOnly ? eventDay(event) >= today : event.startsAt >= data.fetchedAt) && event.impact === "high");
  const days = [...new Set(events.map(eventDay))];
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-semibold">მაკრო გარემო</h2><p className="mt-2 text-xs text-muted">მოვლენები და ეკონომიკური მაჩვენებლები · დრო: თბილისი</p></div>
      <span className="text-[10px] text-muted">შემოწმდა {dateTime(data.fetchedAt)}</span>
    </div>
    {next && <section className="rounded-xl border border-amber-300/20 bg-amber-300/[0.04] p-5">
      <p className="text-[10px] font-medium text-amber-200">შემდეგი მნიშვნელოვანი მოვლენა</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><h3 className="text-base font-medium">{next.name}</h3><span className="text-xs text-muted">{dateTime(next.startsAt, !!next.dateOnly)}{next.dateOnly ? " · საათი დაუზუსტებელია" : ""}</span></div>
    </section>}
    {data.calendarStatus !== "ready" && <p role="status" className="border-l-2 border-amber-300/50 pl-4 text-xs leading-6 text-muted">
      {data.calendarStatus === "unavailable" ? "კალენდრის წყარო დროებით მიუწვდომელია." : "ნაჩვენებია FED-ის ოფიციალური განრიგი."}
      {data.consensusConfigured ? " სრული კალენდრის წყაროსთან დაკავშირება ვერ მოხერხდა." : " CPI, NFP და სხვა მოვლენების სრული კალენდრისა და მოლოდინების წყარო ჯერ არ არის დაკავშირებული."}
    </p>}
    <section className="panel overflow-hidden">
      <div className="space-y-4 border-b border-line p-5"><h3 className="text-sm font-medium">ეკონომიკური კალენდარი</h3>
        <div className="flex flex-wrap items-center gap-2">
          {[["all","მომავალი"],["today","დღეს"],["week","შემდეგი 7 დღე"],["past","გასული"]].map(([id,label]) => <button key={id} aria-pressed={period === id} onClick={() => setPeriod(id)} className={`rounded-lg px-3 py-2 text-xs ${period === id ? "bg-brand/15 text-brand" : "text-muted hover:bg-raised"}`}>{label}</button>)}
          <select aria-label="მოვლენის კატეგორია" value={category} onChange={e => setCategory(e.target.value)} className="!w-auto !py-2 text-xs"><option value="all">ყველა კატეგორია</option><option value="fed">FED</option><option value="inflation">ინფლაცია</option><option value="labor">შრომის ბაზარი</option><option value="growth">ეკონომიკური ზრდა</option></select>
          <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={highOnly} onChange={e => setHighOnly(e.target.checked)} />მხოლოდ მნიშვნელოვანი</label>
        </div>
      </div>
      {days.map(day => <div key={day}><div className={`border-b border-line px-5 py-3 text-xs ${day === today ? "bg-brand/10 text-brand" : "bg-raised/40 text-muted"}`}>{day === today ? "დღეს · " : ""}{dateTime(`${day}T12:00:00Z`, true)}</div>
        {events.filter(event => eventDay(event) === day).map(event => <EventRow key={event.id} event={event} />)}
      </div>)}
      {!events.length && <p className="p-8 text-center text-xs leading-6 text-muted">არჩეულ პერიოდში შესაბამისი მოვლენები არ არის. სცადეთ სხვა ფილტრი.</p>}
      <p className="border-t border-line p-4 text-[10px] leading-5 text-muted">ქარვისფერი — მაღალი მნიშვნელობა · იისფერი — საშუალო მნიშვნელობა · ნაცრისფერი — დაბალი. ფერები ყიდვა/გაყიდვის სიგნალს არ აღნიშნავს. „—“ ნიშნავს, რომ მონაცემი წყაროში არ არის.</p>
    </section>
    <details className="panel p-5"><summary className="text-sm font-medium">ეკონომიკური მაჩვენებლები <span className="ml-2 text-xs text-muted">{data.metrics.length}</span></summary><div className="mt-5 grid gap-x-8 sm:grid-cols-2">{data.metrics.map(metric => <div key={metric.id} className="flex items-center justify-between gap-4 border-t border-line py-4"><div><p className="text-xs">{metric.label}</p><p className="mt-1 text-[10px] text-muted">{metric.source} · {metric.observationDate ?? "თარიღი უცნობია"}</p></div><span className="numeric text-sm">{metric.value === null ? "—" : metric.unit === "%" ? percentage(metric.value) : quantity(metric.value)}</span></div>)}</div></details>
  </div>;
}

function EventRow({ event }: { event: MacroEvent }) {
  const tone = event.impact === "high" ? "border-amber-300/60 text-amber-200" : event.impact === "medium" ? "border-brand/60 text-brand" : "border-muted/30 text-muted";
  return <details className="group border-b border-line last:border-0 open:bg-brand/[0.03]">
    <summary className="flex list-none cursor-pointer flex-wrap items-center justify-between gap-4 p-5 hover:bg-raised/30">
      <div className={`min-w-0 border-l-2 pl-3 ${tone}`}><p className="text-[10px]">{event.impact === "high" ? "მაღალი მნიშვნელობა" : event.impact === "medium" ? "საშუალო მნიშვნელობა" : "დაბალი მნიშვნელობა"}</p><h4 className="mt-1 text-xs text-foreground">{event.name}</h4><p className="mt-2 text-[10px] text-muted">{event.dateOnly ? "საათი დაუზუსტებელია" : dateTime(event.startsAt)} · {event.source}</p></div>
      <div className="flex gap-5 text-right text-xs"><Datum label="წინა" value={event.previous} /><Datum label="მოლოდინი" value={event.forecast} /><Datum label="ფაქტობრივი" value={event.actual} /></div>
    </summary><div className="px-8 pb-5 text-xs leading-6 text-muted">მოლოდინი წარმოადგენს წყაროს კონსენსუსს. ცარიელი ფაქტობრივი მნიშვნელობა არ ადასტურებს, რომ მოვლენა ჯერ არ გამოქვეყნებულა — მონაცემი შეიძლება დაგვიანებით მოვიდეს. {event.dateOnly && "წყარომ მხოლოდ თარიღი მოგვაწოდა."}</div>
  </details>;
}
function Datum({ label, value }: { label: string; value?: string | null }) { return <div><p className="text-[10px] text-muted">{label}</p><p className="numeric mt-2">{value || "—"}</p></div>; }
