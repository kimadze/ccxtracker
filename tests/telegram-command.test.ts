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
