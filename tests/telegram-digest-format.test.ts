import { expect, it } from "vitest";
import { replayLedger } from "@/domain/ledger";
import { valuePortfolio } from "@/domain/valuation";
import {
  formatDailyDigest,
  type DigestData,
} from "@/server/telegram/digest-format";

const empty = valuePortfolio(replayLedger([]), [], []);
const base: DigestData = {
  day: "2026-10-12",
  preparedAt: new Date("2026-10-12T17:01:00Z"),
  portfolios: [
    { id: "p", name: "ჩემი <პორტფელი> & მეგობრები", summary: empty },
  ],
  alerts: [],
};
it("formats an empty portfolio compactly and escapes HTML", () => {
  const body = formatDailyDigest(base);
  expect(body).toContain("დღიური ანგარიში · 12 ოქტომბერი");
  expect(body).toContain("&lt;პორტფელი&gt; &amp; მეგობრები");
  expect(body).toContain("დღეს ალერტი არ ამოქმედებულა");
  expect(body).toContain("00:00–21:01");
  expect(body).not.toContain("რეალიზებული");
  expect(body).not.toContain("ცვლილება");
});
it("distinguishes incomplete, stale and unknown basis without inventing P/L", () => {
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
          costBasis: null,
          totalPnl: null,
        },
      },
    ],
  });
  expect(body).toContain("ცნობილი ღირებულება: <b>$23,50</b>");
  expect(body).toContain("სრული P/L: <b>—</b>");
  expect(body).toContain(
    "ფასები არასრულია · ფასები მოძველებულია · თვითღირებულება უცნობია",
  );
});
it("does not treat a closed position with realized profit as an empty portfolio", () => {
  const body = formatDailyDigest({
    ...base,
    portfolios: [
      {
        ...base.portfolios[0],
        summary: {
          ...empty,
          realizedPnl: "125",
          totalPnl: "125",
        },
      },
    ],
  });
  expect(body).toContain("რეალიზებული · მთელი ისტორია: $125,00");
  expect(body).toContain("სრული P/L: <b>$125,00</b>");
});
it("shows five newest events, grouped by portfolio, with exact small prices and remaining count", () => {
  const body = formatDailyDigest({
    ...base,
    alerts: Array.from({ length: 7 }, (_, i) => ({
      portfolioId: "p",
      symbol: "XLM",
      kind: i % 2 ? "ზრდა ↑" : `TP${i + 1}`,
      target: "0.0000000012",
      price: "0.0000000013",
      at: new Date(`2026-10-12T17:0${i}:00Z`),
    })),
  });
  expect(body).toContain("TP7");
  expect(body).not.toContain("TP1");
  expect(body).toContain("კიდევ 2");
  expect(body).toContain("სამიზნე $0,0000000012 · დაფიქსირდა $0,0000000013");
});
it("bounds long reports at complete HTML blocks", () => {
  const body = formatDailyDigest({
    ...base,
    portfolios: Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      name: "<&>".repeat(80),
      summary: {
        ...empty,
        cash: "100000",
        value: "100000",
        realizedPnl: "-5000",
        totalPnl: "-5000",
      },
    })),
  });
  expect(body.length).toBeLessThan(3800);
  expect(body.match(/<b>/g)?.length).toBe(body.match(/<\/b>/g)?.length);
  expect(body).toContain("დანარჩენი დეტალები იხილე აპში.");
});
