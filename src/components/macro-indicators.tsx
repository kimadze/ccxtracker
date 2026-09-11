import type { MacroMetric, MacroStatistics } from "@/domain/statistics";
import { dateTime, percentage, quantity } from "@/lib/formatters";

const groups = [
  {
    title: "მონეტარული პოლიტიკა",
    caption: "FED და ობლიგაციების შემოსავლიანობა",
    ids: ["FED_FUNDS", "US_2Y", "US_10Y"],
    tone: "border-t-brand",
    marker: "bg-brand",
  },
  {
    title: "ინფლაცია",
    caption: "სამომხმარებლო ფასების წლიური ცვლილება",
    ids: ["CPI_YOY", "CORE_CPI_YOY"],
    tone: "border-t-amber-300/70",
    marker: "bg-amber-300",
  },
  {
    title: "შრომის ბაზარი",
    caption: "აშშ-ის დასაქმების მდგომარეობა",
    ids: ["UNEMPLOYMENT"],
    tone: "border-t-positive/70",
    marker: "bg-positive",
  },
  {
    title: "ზრდა და ბაზრის პირობები",
    caption: "ეკონომიკური ზრდა და დოლარის ძალა",
    ids: ["GDP_GROWTH", "DOLLAR_INDEX"],
    tone: "border-t-sky-300/70",
    marker: "bg-sky-300",
  },
] as const;

function metricValue(metric: MacroMetric) {
  if (metric.value === null) return "—";
  return metric.unit === "%" ? percentage(metric.value) : quantity(metric.value);
}

function IndicatorCard({
  title,
  caption,
  metrics,
  tone,
  marker,
}: {
  title: string;
  caption: string;
  metrics: MacroMetric[];
  tone: string;
  marker: string;
}) {
  const primary = metrics[0];
  return (
    <article className={`panel overflow-hidden border-t-2 ${tone}`}>
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className={`mt-1 size-2 shrink-0 rounded-full ${marker}`} />
          <div>
            <h3 className="text-sm font-medium">{title}</h3>
            <p className="mt-1.5 text-[10px] leading-5 text-muted">{caption}</p>
          </div>
        </div>
        {primary ? (
          <div className="mt-7">
            <p className="text-[11px] text-muted">{primary.label}</p>
            <p className="numeric mt-2 text-3xl font-semibold tracking-tight">
              {metricValue(primary)}
            </p>
            <p className="mt-2 text-[10px] text-muted">
              {primary.source} · {primary.observationDate ?? "განახლების თარიღი უცნობია"}
            </p>
          </div>
        ) : (
          <p className="mt-7 text-xs text-muted">მონაცემი დროებით მიუწვდომელია.</p>
        )}
      </div>
      {metrics.length > 1 && (
        <div className="divide-y divide-line border-t border-line bg-raised/25 px-5 sm:px-6">
          {metrics.slice(1).map((metric) => (
            <div key={metric.id} className="flex items-center justify-between gap-5 py-4">
              <div>
                <p className="text-xs">{metric.label}</p>
                <p className="mt-1 text-[10px] text-muted">{metric.observationDate ?? "—"}</p>
              </div>
              <p className="numeric text-base font-medium">{metricValue(metric)}</p>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export function MacroIndicators({ data }: { data: MacroStatistics }) {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">ეკონომიკური მაჩვენებლები</h2>
          <p className="mt-2 text-xs leading-6 text-muted">
            აშშ-ის ეკონომიკის უახლესი ოფიციალური მონაცემები.
          </p>
        </div>
        <p className="text-[10px] text-muted">შემოწმდა {dateTime(data.fetchedAt)}</p>
      </header>
      {data.metrics.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((group) => (
            <IndicatorCard
              key={group.title}
              title={group.title}
              caption={group.caption}
              tone={group.tone}
              marker={group.marker}
              metrics={group.ids.flatMap((id) => {
                const metric = data.metrics.find((item) => item.id === id);
                return metric ? [metric] : [];
              })}
            />
          ))}
        </div>
      ) : (
        <div className="panel p-10 text-center">
          <h3 className="text-sm font-medium">მაკრო მონაცემები მიუწვდომელია</h3>
          <p className="mt-3 text-xs leading-6 text-muted">სცადეთ გვერდის განახლება მოგვიანებით.</p>
        </div>
      )}
      <p className="text-[10px] leading-5 text-muted">
        წყარო: Federal Reserve Economic Data (FRED). თითოეული მაჩვენებლის თარიღი
        ასახავს წყაროში არსებულ ბოლო დაკვირვებას.
      </p>
    </div>
  );
}
