import "server-only";
import type { MacroMetric, MacroStatistics } from "@/domain/statistics";
import { latestObservation, percentageChange } from "@/domain/statistics";
import { decimal } from "@/domain/decimal";

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
    return {
      ...definition,
      value: null,
      observationDate: null,
      source: "FRED",
      change: null,
      changeUnit: definition.unit === "index" ? "პუნქტი" : "პპ",
      available: false,
    };
  const valid = observations.filter((item) => item.value !== ".");
  const offset = definition.transform === "yoy" ? 12 : 1;
  const calculate = (index: number) => {
    const current = valid[index];
    if (!current) return null;
    if (!definition.transform) return current.value;
    const base = valid[index - offset];
    return base ? percentageChange(current.value, base.value) : null;
  };
  const result = calculate(valid.length - 1);
  const priorResult = calculate(valid.length - 2);
  const change =
    result !== null && priorResult !== null
      ? decimal(result).minus(priorResult).toFixed()
      : null;
  return {
    id: definition.id,
    label: definition.label,
    value: result,
    unit: definition.unit,
    observationDate: latest.date,
    source: "FRED",
    change,
    changeUnit:
      definition.unit === "index"
        ? "პუნქტი"
        : definition.transform || definition.unit === "%"
          ? "პპ"
          : "%",
    available: result !== null,
  };
}

export async function getMacroStatistics(): Promise<MacroStatistics> {
  const settled = await Promise.allSettled(series.map(fetchSeries));
  const metrics = settled.map((result, index) =>
    result.status === "fulfilled"
      ? result.value
      : {
          id: series[index].id,
          label: series[index].label,
          value: null,
          unit: series[index].unit,
          observationDate: null,
          source: "FRED",
          change: null,
          changeUnit: series[index].unit === "index" ? "პუნქტი" as const : "პპ" as const,
          available: false,
        },
  );
  if (settled.some((result) => result.status === "rejected"))
    console.warn("One or more FRED macro series are unavailable");
  return {
    metrics,
    fetchedAt: new Date().toISOString(),
    error: metrics.every((metric) => !metric.available),
  };
}
