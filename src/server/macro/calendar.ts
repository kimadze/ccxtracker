import "server-only";
import { z } from "zod";
import type { MacroEvent } from "@/domain/statistics";

const optionalText = z.string().nullable().optional();
const schema = z.array(z.object({
  CalendarId: z.union([z.string(), z.number()]), Date: z.string(),
  Event: z.string(), Category: optionalText, Actual: optionalText,
  Previous: optionalText, Forecast: optionalText,
  Importance: z.number().optional(),
}));

export function normalizeCalendar(payload: unknown): MacroEvent[] {
  return schema.parse(payload).flatMap((row): MacroEvent[] => {
    const stamp = /Z$|[+-]\d\d:\d\d$/.test(row.Date) ? row.Date : `${row.Date}Z`;
    if (!Number.isFinite(Date.parse(stamp))) return [];
    const name = row.Event.toLowerCase();
    const category = /interest rate|fomc|fed /.test(name) ? "fed"
      : /inflation|cpi|ppi|pce|personal income|personal spending/.test(name) ? "inflation"
      : /payroll|employment|jobless|earnings|jolts/.test(name) ? "labor"
      : /gdp/.test(name) ? "growth" : "other";
    if (category === "other") return [];
    const label = /core inflation/.test(name) ? "საბაზო ინფლაცია"
      : /inflation/.test(name) ? "ინფლაცია"
      : /non farm payroll/.test(name) ? "NFP — ახალი სამუშაო ადგილები"
      : /unemployment/.test(name) ? "უმუშევრობის დონე"
      : /interest rate/.test(name) ? "FED — განაკვეთის გადაწყვეტილება"
      : /jobless/.test(name) ? "უმუშევრობის დახმარების მოთხოვნები"
      : /gdp/.test(name) ? "GDP — ეკონომიკური ზრდა"
      : category === "inflation" ? "ფასები და სამომხმარებლო ხარჯები"
      : category === "labor" ? "შრომის ბაზარი" : "FED — მოვლენა";
    return [{ id: String(row.CalendarId), name: `${label}${/yoy/.test(name) ? " · YoY" : /mom/.test(name) ? " · MoM" : ""}`,
      startsAt: new Date(stamp).toISOString(), category,
      impact: row.Importance === 3 ? "high" : row.Importance === 2 ? "medium" : "low",
      source: "Trading Economics", previous: row.Previous || null,
      actual: row.Actual || null, forecast: row.Forecast || null,
    }];
  }).sort((a,b) => a.startsAt.localeCompare(b.startsAt));
}

export async function getEconomicCalendar(fallback: () => Promise<MacroEvent[]>) {
  const key = process.env.TRADING_ECONOMICS_API_KEY;
  if (key) {
    try {
      const now = new Date();
      const from = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0,10);
      const to = new Date(now.getTime() + 90 * 86400000).toISOString().slice(0,10);
      const response = await fetch(`https://api.tradingeconomics.com/calendar/country/united%20states/${from}/${to}?c=${encodeURIComponent(key)}&f=json`, {
        signal: AbortSignal.timeout(12000), next: { revalidate: 300 },
      });
      if (!response.ok) throw new Error("CALENDAR_UNAVAILABLE");
      const events = normalizeCalendar(await response.json());
      if (events.length) return { events, status: "ready" as const };
    } catch { console.warn("Economic calendar unavailable; trying official FED schedule"); }
  }
  try {
    const events = await fallback();
    return { events, status: events.length ? "partial" as const : "unavailable" as const };
  } catch { return { events: [], status: "unavailable" as const }; }
}
