import { decimal } from "@/domain/decimal";
function formatted(value: string, places: number, trim = false) {
  const [integer, fraction = ""] = decimal(value).toFixed(places).split(".");
  const digits = trim ? fraction.replace(/0+$/, "") : fraction;
  return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0")}${digits ? `,${digits}` : ""}`;
}
export function money(value: string | null, compact = false) {
  if (value === null) return "—";
  const number = decimal(value),
    sign = number.lt(0) ? "-" : "",
    absolute = number.abs();
  if (compact && absolute.gte(1000000))
    return `${sign}$${formatted(absolute.div(1000000).toFixed(), 1, true)} მლნ`;
  if (compact && absolute.gte(1000))
    return `${sign}$${formatted(absolute.div(1000).toFixed(), 1, true)} ათ.`;
  return `${sign}$${formatted(absolute.toFixed(), 2)}`;
}
export function compactMoney(value: string | null) {
  if (value === null) return "—";
  const number = decimal(value),
    sign = number.lt(0) ? "-" : "",
    absolute = number.abs(),
    units = [
      { threshold: "1000000000000", divisor: "1000000000000", suffix: "ტრილ." },
      { threshold: "1000000000", divisor: "1000000000", suffix: "მლრდ" },
      { threshold: "1000000", divisor: "1000000", suffix: "მლნ" },
      { threshold: "1000", divisor: "1000", suffix: "ათ." },
    ];
  const unit = units.find((candidate) => absolute.gte(candidate.threshold));
  if (!unit) return money(value);
  return `${sign}$${formatted(absolute.div(unit.divisor).toFixed(), 2, true)} ${unit.suffix}`;
}
export function quantity(value: string) {
  return formatted(
    value,
    decimal(value).abs().gt(0) && decimal(value).abs().lt("0.00000001")
      ? 18
      : 8,
    true,
  );
}
export function percentage(value: string | null, signed = false) {
  return value === null
    ? "—"
    : `${signed && decimal(value).gt(0) ? "+" : ""}${formatted(value, 2, true)}%`;
}
const months = [
  "იან",
  "თებ",
  "მარ",
  "აპრ",
  "მაი",
  "ივნ",
  "ივლ",
  "აგვ",
  "სექ",
  "ოქტ",
  "ნოე",
  "დეკ",
];
export function dateTime(value: string | Date | number, short = false) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tbilisi",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")} ${months[Number(get("month")) - 1]}${short ? "" : ` ${get("year")}, ${get("hour")}:${get("minute")}`}`;
}
export function pnlClass(value: string | null) {
  return value === null || decimal(value).isZero()
    ? "text-muted"
    : decimal(value).gt(0)
      ? "text-positive"
      : "text-negative";
}
