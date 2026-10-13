import type { PortfolioSummary } from "@/domain/types";
import type { DailyChange } from "@/domain/daily-change";
import { decimal } from "@/domain/decimal";
import { money, percentage } from "@/lib/formatters";
export const DIGEST_PREFIX = "<b>დღიური ანგარიში · ";
export interface DigestData {
  day: string;
  preparedAt: Date;
  portfolios: {
    id: string;
    name: string;
    summary: PortfolioSummary;
    change: DailyChange;
  }[];
}
export function escapeTelegram(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
export function isCurrentDigest(body: string | null) {
  return Boolean(
    body?.startsWith(DIGEST_PREFIX) && body.includes("\nდღის შედეგი"),
  );
}
function clock(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tbilisi",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(value);
}
export function formatDailyDigest(data: DigestData) {
  const date = new Intl.DateTimeFormat("ka-GE", {
    timeZone: "Asia/Tbilisi",
    day: "numeric",
    month: "long",
  }).format(new Date(`${data.day}T12:00:00+04:00`));
  const blocks = [`${DIGEST_PREFIX}${date}</b>`];
  for (const p of data.portfolios) {
    const s = p.summary,
      c = p.change;
    const change =
      c.amount === null
        ? "—"
        : `${decimal(c.amount).gt(0) ? "+" : ""}${money(c.amount)}${c.percent === null ? "" : ` · ${percentage(c.percent, true)}`}`;
    const range = c.from
      ? ` · ${clock(new Date(c.from))}–${clock(data.preparedAt)}`
      : "";
    const warnings = [
      ...new Set(
        [
          c.reason,
          !s.complete ? "ფასები არასრულია" : null,
          s.stale ? "ფასები მოძველებულია" : null,
        ].filter(Boolean),
      ),
    ];
    blocks.push(
      `<b>${escapeTelegram(p.name.slice(0, 80))}</b>\nდღის შედეგი${range}: <b>${change}</b>\n${s.complete ? "პორტფელის ღირებულება" : "ცნობილი ღირებულება"}: <b>${money(s.complete ? s.value : s.knownValue)}</b>${warnings.length ? `\n${warnings.join(" · ")}` : ""}`,
    );
  }
  const result: string[] = [];
  for (const block of blocks) {
    if ([...result, block].join("\n\n").length > 3700) {
      result.push("დანარჩენი პორტფელები იხილე აპში.");
      break;
    }
    result.push(block);
  }
  return result.join("\n\n");
}
