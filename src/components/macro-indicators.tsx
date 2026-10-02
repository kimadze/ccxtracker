import type { MacroMetric, MacroStatistics } from "@/domain/statistics";
import { dateTime, percentage, quantity, pnlClass } from "@/lib/formatters";

function metricValue(metric: MacroMetric) {
  if (metric.value === null) return "—";
  return metric.unit === "%"
    ? percentage(metric.value)
    : quantity(metric.value);
}

export function MacroIndicators({ data }: { data: MacroStatistics }) {
  return (
    <div className="space-y-3 lg:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">ეკონომიკური მაჩვენებლები</h2>
        <span className="text-xs text-base-content/60">
          {dateTime(data.fetchedAt)}
        </span>
      </div>
      {data.metrics.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 lg:gap-4">
          {data.metrics.map((metric) => (
            <article
              key={metric.id}
              className="card card-border min-w-0 bg-base-200 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-medium">{metric.label}</h3>
                <span
                  className={`status mt-1 shrink-0 ${metric.value === null ? "status-warning" : "status-success"}`}
                  aria-label={
                    metric.value === null
                      ? "მონაცემი მიუწვდომელია"
                      : "მონაცემი ხელმისაწვდომია"
                  }
                />
              </div>
              <div className="my-2 flex items-baseline justify-between gap-2 tabular-nums">
                <strong className="whitespace-nowrap text-2xl">
                  {metricValue(metric)}
                </strong>
                <span
                  className={`whitespace-nowrap text-xs ${pnlClass(metric.change)}`}
                >
                  {percentage(metric.change, true)}
                </span>
              </div>
              <details className="collapse collapse-arrow rounded-field bg-base-100">
                <summary className="collapse-title min-h-11 py-3 text-xs">
                  წყარო და თარიღი
                </summary>
                <div className="collapse-content text-xs text-base-content/60">
                  {metric.source} · {metric.observationDate ?? "თარიღი უცნობია"}
                </div>
              </details>
            </article>
          ))}
        </div>
      ) : (
        <div role="alert" className="alert alert-warning alert-soft text-sm">
          მაკრო მონაცემები მიუწვდომელია. სცადეთ მოგვიანებით.
        </div>
      )}
    </div>
  );
}
