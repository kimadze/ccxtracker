export function StatisticsTrend({
  values,
  dates,
  label,
  className = "text-primary",
}: {
  values: number[];
  dates?: string[];
  label: string;
  className?: string;
}) {
  if (values.length < 2 || values.some((value) => !Number.isFinite(value)))
    return (
      <span className="text-xs text-base-content/50">ისტორია მიუწვდომელია</span>
    );
  const low = Math.min(...values),
    high = Math.max(...values);
  const times = dates?.map((date) => Date.parse(date));
  const first = times?.[0] ?? 0,
    last = times?.at(-1) ?? 0;
  const points = values
    .map((value, index) => {
      const x =
        times && last > first
          ? (times[index] - first) / (last - first)
          : index / (values.length - 1);
      const y = high === low ? 24 : 44 - ((value - low) / (high - low)) * 40;
      return `${4 + x * 192},${y}`;
    })
    .join(" ");
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox="0 0 200 48"
      preserveAspectRatio="none"
      className={`h-12 w-full ${className}`}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
