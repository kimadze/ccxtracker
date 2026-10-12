import type { PortfolioSummary } from "@/domain/types";
import { decimal } from "@/domain/decimal";
import { money, unitPrice } from "@/lib/formatters";

export const DIGEST_PREFIX = "<b>დღიური ანგარიში · ";
export interface DigestAlert {
  portfolioId: string;
  symbol: string;
  kind: string;
  target: string | null;
  price: string | null;
  at: Date;
}
export interface DigestData {
  day: string;
  preparedAt: Date;
  portfolios: { id: string; name: string; summary: PortfolioSummary }[];
  alerts: DigestAlert[];
}
export function escapeTelegram(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function time(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tbilisi",
    hour: "2-digit",
    minute: "2-digit",
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
    const s = p.summary;
    const name = escapeTelegram(p.name.slice(0, 80));
    if (
      s.complete &&
      !s.stale &&
      !s.positions.length &&
      decimal(s.cash).isZero() &&
      s.totalPnl !== null &&
      decimal(s.totalPnl).isZero()
    ) {
      blocks.push(
        `<b>${name}</b> · ${money(s.value)} · P/L ${money(s.totalPnl)}`,
      );
      continue;
    }
    const warnings = [
      !s.complete ? "ფასები არასრულია" : null,
      s.stale ? "ფასები მოძველებულია" : null,
      s.costBasis === null || s.realizedPnl === null
        ? "თვითღირებულება უცნობია"
        : null,
    ].filter(Boolean);
    blocks.push(
      `<b>${name}</b>\n${s.complete ? "ღირებულება" : "ცნობილი ღირებულება"}: <b>${money(s.complete ? s.value : s.knownValue)}</b>\nსრული P/L: <b>${money(s.complete && !s.stale ? s.totalPnl : null)}</b>\nრეალიზებული · მთელი ისტორია: ${money(s.realizedPnl)}${warnings.length ? `\n${warnings.join(" · ")}` : ""}`,
    );
  }
  const alerts = [...data.alerts].sort(
    (a, b) => b.at.getTime() - a.at.getTime(),
  );
  blocks.push(
    `<b>ალერტები · დღეს 00:00–${time(data.preparedAt)}</b> · თბილისის დროით`,
  );
  if (!alerts.length) blocks.push("დღეს ალერტი არ ამოქმედებულა");
  else {
    const latest = alerts.slice(0, 5);
    for (const p of data.portfolios) {
      const selected = latest.filter((a) => a.portfolioId === p.id);
      if (!selected.length) continue;
      blocks.push(`<b>${escapeTelegram(p.name.slice(0, 80))}</b>`);
      for (const a of selected)
        blocks.push(
          `${escapeTelegram(a.symbol.slice(0, 24))} · ${escapeTelegram(a.kind)}\nსამიზნე ${unitPrice(a.target)} · დაფიქსირდა ${unitPrice(a.price)} · ${time(a.at)}`,
        );
    }
    if (alerts.length > 5)
      blocks.push(`კიდევ ${alerts.length - 5} · დეტალები აპში`);
  }
  const result: string[] = [];
  for (const block of blocks) {
    // Bound raw HTML as well as rendered text; never cut a tag or entity.
    if ([...result, block].join("\n\n").length > 3700) {
      result.push("დანარჩენი დეტალები იხილე აპში.");
      break;
    }
    result.push(block);
  }
  return result.join("\n\n");
}
