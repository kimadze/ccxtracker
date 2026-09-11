import "server-only";
import type { MacroMetric, MacroStatistics } from "@/domain/statistics";
import { latestObservation, percentageChange } from "@/domain/statistics";
import { getEconomicCalendar } from "./calendar";

interface SeriesDefinition {
  id: string;
  label: string;
  fredId: string;
  unit: MacroMetric["unit"];
  transform?: "yoy" | "mom";
}

const series: SeriesDefinition[] = [
  { id: "FED_FUNDS", label: "FED განაკვეთი", fredId: "FEDFUNDS", unit: "%" },
  { id: "CPI_YOY", label: "CPI YoY", fredId: "CPIAUCSL", unit: "%", transform: "yoy" },
  { id: "CORE_CPI_YOY", label: "Core CPI YoY", fredId: "CPILFESL", unit: "%", transform: "yoy" },
  { id: "UNEMPLOYMENT", label: "უმუშევრობა", fredId: "UNRATE", unit: "%" },
  { id: "GDP_GROWTH", label: "GDP ზრდა", fredId: "A191RL1Q225SBEA", unit: "%" },
  { id: "US_2Y", label: "აშშ 2-წლიანი ობლიგაცია", fredId: "DGS2", unit: "%" },
  { id: "US_10Y", label: "აშშ 10-წლიანი ობლიგაცია", fredId: "DGS10", unit: "%" },
  { id: "DOLLAR_INDEX", label: "აშშ დოლარის ფართო ინდექსი", fredId: "DTWEXBGS", unit: "index" },
];

function parseCsv(csv: string, id: string) {
  const lines = csv.trim().split(/\r?\n/).slice(1);
  return lines.flatMap((line) => {
    const split = line.split(",");
    return split.length >= 2 ? [{ date: split[0], value: split[1], id }] : [];
  });
}

async function fetchSeries(definition: SeriesDefinition): Promise<MacroMetric> {
  const response = await fetch(
    `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${definition.fredId}`,
    { signal: AbortSignal.timeout(12000), next: { revalidate: 21600 } },
  );
  if (!response.ok) throw new Error(`FRED_${response.status}`);
  const observations = parseCsv(await response.text(), definition.fredId);
  const latest = latestObservation(observations);
  if (!latest)
    return { ...definition, value: null, observationDate: null, source: "FRED", change: null };
  let result = latest.value;
  if (definition.transform) {
    const offset = definition.transform === "yoy" ? 12 : 1;
    const valid = observations.filter((item) => item.value !== ".");
    const previous = valid[valid.length - 1 - offset];
    result = previous ? (percentageChange(latest.value, previous.value) ?? latest.value) : latest.value;
  }
  const valid = observations.filter((item) => item.value !== ".");
  const prior = valid[valid.length - 2];
  return {
    id: definition.id,
    label: definition.label,
    value: result,
    unit: definition.unit,
    observationDate: latest.date,
    source: "FRED",
    change: prior ? String(Number(latest.value) - Number(prior.value)) : null,
  };
}

const monthNumbers: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

export function parseFomcMeetings(html: string, now = new Date()) {
  const events: MacroStatistics["events"] = [];
  const sections = html.matchAll(
    /(20\d{2})\s+FOMC Meetings([\s\S]*?)(?=(?:20\d{2})\s+FOMC Meetings|$)/gi,
  );
  for (const section of sections) {
    const year = Number(section[1]);
    const meetings = section[2].matchAll(
      /fomc-meeting__month[^>]*>\s*(?:<strong>)?([^<]+)[\s\S]*?fomc-meeting__date[^>]*>\s*([^<]+)/gi,
    );
    for (const meeting of meetings) {
      const month = monthNumbers[meeting[1].trim().toLowerCase()];
      const days = meeting[2].match(/\d{1,2}/g)?.map(Number) ?? [];
      if (month === undefined || !days.length) continue;
      // The official page supplies meeting dates but no machine-readable release time.
      // Noon UTC keeps the calendar date stable without inventing a decision timestamp.
      const startsAt = new Date(Date.UTC(year, month, days[days.length - 1], 12));
      if (startsAt.toISOString().slice(0, 10) < now.toISOString().slice(0, 10)) continue;
      events.push({
        id: `fomc-${year}-${month + 1}-${days[days.length - 1]}`,
        name: "FOMC განაკვეთის გადაწყვეტილება",
        startsAt: startsAt.toISOString(),
        impact: "high",
        source: "Federal Reserve",
        dateOnly: true,
        category: "fed",
      });
    }
  }
  return events.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

async function fetchFomcMeetings() {
  const response = await fetch(
    "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
    { signal: AbortSignal.timeout(12000), next: { revalidate: 86400 } },
  );
  if (!response.ok) throw new Error(`FED_CALENDAR_${response.status}`);
  return parseFomcMeetings(await response.text());
}

export async function getMacroStatistics(): Promise<MacroStatistics> {
  const [seriesResult, calendarResult] = await Promise.all([
    Promise.allSettled(series.map(fetchSeries)),
    getEconomicCalendar(fetchFomcMeetings),
  ]);
  const settled = seriesResult;
  const metrics = settled.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  if (settled.some((result) => result.status === "rejected"))
    console.warn("One or more FRED macro series are unavailable");
  return {
    metrics,
    events: calendarResult.events,
    calendarStatus: calendarResult.status,
    consensusConfigured: !!process.env.TRADING_ECONOMICS_API_KEY,
    fetchedAt: new Date().toISOString(),
    error: metrics.length === 0,
  };
}
