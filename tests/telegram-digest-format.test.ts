import { expect, it } from "vitest";
import { replayLedger } from "@/domain/ledger";
import { valuePortfolio } from "@/domain/valuation";
import {
  formatDailyDigest,
  isCurrentDigest,
  type DigestData,
} from "@/server/telegram/digest-format";
const empty = valuePortfolio(replayLedger([]), [], []);
const base: DigestData = {
  day: "2026-10-12",
  preparedAt: new Date("2026-10-12T17:01:00Z"),
  portfolios: [
    {
      id: "p",
      name: "ჩემი <პორტფელი> & მეგობრები",
      summary: empty,
      change: {
        amount: "125.4",
        percent: "2.8",
        from: "2026-10-11T20:00:00Z",
        reason: null,
      },
    },
  ],
};
it("shows only daily result and value, escapes names and retains the exact period", () => {
  const body = formatDailyDigest(base);
  expect(body).toContain("დღიური ანგარიში · 12 ოქტომბერი");
  expect(body).toContain("&lt;პორტფელი&gt; &amp; მეგობრები");
  expect(body).toContain("დღის შედეგი · 00:00–21:01: <b>+$125,40 · +2,8%</b>");
  expect(body).toContain("პორტფელის ღირებულება: <b>$0,00</b>");
  for (const term of ["ალერტი", "რეალიზებული", "სრული P/L", "Luna"])
    expect(body).not.toContain(term);
  expect(isCurrentDigest(body)).toBe(true);
  expect(
    isCurrentDigest("<b>დღიური ანგარიში · ძველი</b>\nსრული P/L: $10"),
  ).toBe(false);
});
it("shows loss and unknown percentage without claiming a return on zero capital", () => {
  const body = formatDailyDigest({
    ...base,
    portfolios: [
      {
        ...base.portfolios[0],
        change: {
          amount: "-25",
          percent: null,
          from: base.portfolios[0].change.from,
          reason: null,
        },
      },
    ],
  });
  expect(body).toContain("<b>-$25,00</b>");
  expect(body).not.toContain("%");
});
it("distinguishes missing baseline, incomplete and stale values", () => {
  const body = formatDailyDigest({
    ...base,
    portfolios: [
      {
        ...base.portfolios[0],
        summary: {
          ...empty,
          complete: false,
          stale: true,
          value: null,
          knownValue: "23.5",
        },
        change: {
          amount: null,
          percent: null,
          from: null,
          reason: "ფასები არასრულია",
        },
      },
    ],
  });
  expect(body).toContain("დღის შედეგი: <b>—</b>");
  expect(body).toContain("ცნობილი ღირებულება: <b>$23,50</b>");
  expect(body).toContain("ფასები არასრულია · ფასები მოძველებულია");
  expect(body.match(/ფასები არასრულია/g)).toHaveLength(1);
});
it("keeps complete HTML blocks within Telegram limits", () => {
  const body = formatDailyDigest({
    ...base,
    portfolios: Array.from({ length: 10 }, (_, i) => ({
      ...base.portfolios[0],
      id: String(i),
      name: "<&>".repeat(80),
    })),
  });
  expect(body.length).toBeLessThan(3800);
  expect(body.match(/<b>/g)?.length).toBe(body.match(/<\/b>/g)?.length);
  expect(body).toContain("დანარჩენი პორტფელები იხილე აპში.");
});
