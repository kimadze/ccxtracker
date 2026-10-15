import { expect, it } from "vitest";
import { parseTelegramCommand } from "@/domain/telegram-command";

it("recognizes explicit commands and bounded Georgian phrases", () => {
  expect(parseTelegramCommand("/position xlm")).toEqual({
    kind: "position",
    symbol: "XLM",
  });
  expect(parseTelegramCommand("რამდენი XLM მაქვს?")).toEqual({
    kind: "position",
    symbol: "XLM",
  });
  expect(parseTelegramCommand("მაჩვენე STRK-ის გაყიდვის გეგმა")).toEqual({
    kind: "plan",
    symbol: "STRK",
  });
  expect(parseTelegramCommand("/plan@CCXTRACKER_BOT BTC")).toEqual({
    kind: "plan",
    symbol: "BTC",
  });
  expect(parseTelegramCommand("/help")).toEqual({ kind: "help" });
  expect(parseTelegramCommand("გაყიდე 500 XLM")).toBeNull();
  expect(parseTelegramCommand("/start secret-token")).toBeNull();
});

it("parses report commands and explicit portfolio scope without write commands", () => {
  expect(parseTelegramCommand("/portfolio 2")).toEqual({
    kind: "portfolio",
    portfolio: 2,
  });
  expect(parseTelegramCommand("/sales XLM 1")).toEqual({
    kind: "sales",
    symbol: "XLM",
    portfolio: 1,
  });
  for (const kind of ["alerts", "history", "next", "transactions", "choose"])
    expect(parseTelegramCommand(`/${kind}`)).toEqual({ kind });
  expect(parseTelegramCommand("/portfolio 0")).toBeNull();
  expect(parseTelegramCommand("/portfolio -1")).toBeNull();
  expect(parseTelegramCommand("/sell XLM 100")).toBeNull();
});
