import type { MacroMetric, MacroStatistics } from "@/domain/statistics";
import { percentage, quantity } from "@/lib/formatters";
import { StatisticsTrend } from "./statistics-trend";
function metricValue(metric: MacroMetric) {
  if (metric.value === null) return "—";
  return metric.unit === "%"
    ? percentage(metric.value)
    : quantity(metric.value);
}
export function MacroIndicators({ data }: { data: MacroStatistics }) {
  return (
    <div className="space-y-3 lg:space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">ეკონომიკური მაჩვენებლები</h2>
        <span className="text-xs text-base-content/55">
          FRED · ბოლო წლის დაკვირვებები
        </span>
      </header>
      {data.metrics.some((metric) => !metric.available) && (
        <div
          role="status"
          className="alert alert-warning alert-soft py-2 text-xs"
        >
          {data.error
            ? "მაკრო მონაცემები დროებით მიუწვდომელია."
            : "ზოგიერთი მაჩვენებელი დროებით მიუწვდომელია."}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.metrics.map((metric) => {
          const history = metric.history ?? [];
          const signed =
            metric.change === null
              ? "—"
              : metric.changeUnit === "%"
                ? percentage(metric.change, true)
                : `${Number(metric.change) > 0 ? "+" : ""}${quantity(metric.change)} ${metric.changeUnit}`;
          return (
            <article
              key={metric.id}
              className="card card-border min-w-0 bg-base-200"
            >
              <div className="card-body gap-2 p-3 sm:p-4">
                <h3 className="text-sm font-medium">{metric.label}</h3>
                <div className="flex items-baseline justify-between gap-2">
                  <strong className="numeric whitespace-nowrap text-2xl">
                    {metric.available ? metricValue(metric) : "—"}
                  </strong>
                  <span className="numeric whitespace-nowrap text-xs text-base-content/70">
                    {signed}
                  </span>
                </div>
                <StatisticsTrend
                  values={history.map((point) => Number(point.value))}
                  dates={history.map((point) => point.date)}
                  label={`${metric.label} · ${history[0]?.date ?? "—"} – ${history.at(-1)?.date ?? "—"}`}
                />
                <div className="flex justify-between gap-2 text-[11px] text-base-content/55">
                  <span>{history[0]?.date ?? "—"}</span>
                  <span>{metric.observationDate ?? "—"}</span>
                </div>
                <details className="collapse collapse-arrow rounded-field bg-base-100">
                  <summary className="collapse-title min-h-11 py-3 text-xs">
                    წყარო და შედარება
                  </summary>
                  <div className="collapse-content space-y-2 text-xs text-base-content/60">
                    <p>
                      ცვლილება: {metric.previousDate ?? "—"} →{" "}
                      {metric.observationDate ?? "—"}
                    </p>
                    {metric.sourceUrl ? (
                      <a
                        href={metric.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-11 items-center underline underline-offset-4"
                      >
                        FRED · {metric.label} ↗
                      </a>
                    ) : (
                      <p>{metric.source}</p>
                    )}
                    {metric.changeUnit === "პპ" && (
                      <p>პპ — პროცენტული პუნქტი</p>
                    )}
                  </div>
                </details>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
