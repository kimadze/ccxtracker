import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { Database } from "@/server/db";
import {
  assets,
  exitLevels,
  exitPlans,
  marketQuotes,
  portfolios,
  watchlistItems,
} from "@/server/db/schema";
import { portfolioService } from "@/server/services/portfolio";
import { replayLedger, saleResults } from "@/domain/ledger";
import { valuePortfolio } from "@/domain/valuation";
import { decimal } from "@/domain/decimal";
import { usableAlertQuote } from "@/domain/alert-quote";
import type { TelegramCommand } from "@/domain/telegram-command";
import {
  dateTime,
  money,
  percentage,
  quantity,
  unitPrice,
} from "@/lib/formatters";
import { appOrigin } from "./api";

export async function assistantReport(
  db: Database,
  userId: string,
  ids: string[],
  command: TelegramCommand,
  notificationPreferences = { buyEnabled: true, sellEnabled: true },
) {
  const all = ids.length
    ? await db
        .select()
        .from(portfolios)
        .where(and(eq(portfolios.userId, userId), inArray(portfolios.id, ids)))
        .orderBy(asc(portfolios.createdAt))
    : [];
  const selected = command.portfolio
    ? all.slice(command.portfolio - 1, command.portfolio)
    : all.slice(0, 10);
  const suffix = command.portfolio ? ` ${command.portfolio}` : "";
  const keyboard = [
    [`/portfolio${suffix}`, `/alerts${suffix}`],
    [`/next${suffix}`, `/transactions${suffix}`],
    ["/choose", "/help"],
  ];
  if (command.kind === "choose")
    return {
      body: all.length
        ? `აირჩიეთ პორტფელი\n\n${all
            .slice(0, 10)
            .map(
              (p, i) =>
                `${i + 1}. ${p.name.slice(0, 80)} — /portfolio ${i + 1}`,
            )
            .join(
              "\n",
            )}\n\n/portfolio — ყველა არჩეული (მაქსიმუმ 10). არჩევანი შეტყობინებების პარამეტრებს არ ცვლის.`
        : "Telegram-ის პარამეტრებში აირჩიეთ პორტფელები.",
      keyboard: all
        .slice(0, 10)
        .map((_, i) => [`/portfolio ${i + 1}`])
        .concat([["/portfolio", "/help"]]),
    };
  if (!selected.length)
    return {
      body: "პორტფელი ვერ მოიძებნა. არჩევანის სანახავად: /choose",
      keyboard,
    };
  const catalog = await db.select().from(assets);
  const matching = command.symbol
    ? catalog.filter((a) => a.symbol.toUpperCase() === command.symbol)
    : [];
  if (command.symbol && matching.length !== 1)
    return {
      body: matching.length
        ? "სიმბოლო რამდენიმე აქტივს ეკუთვნის. ზუსტი აქტივი აირჩიეთ აპში."
        : "აქტივი ვერ მოიძებნა. გადაამოწმეთ სიმბოლო.",
      keyboard,
    };
  const asset = matching[0];
  const cached = await db.select().from(marketQuotes);
  const quotes = cached.map((q) => ({
    assetId: q.assetId,
    price: q.price,
    change24h: q.change24h,
    updatedAt: q.quotedAt.toISOString(),
    stale:
      Date.now() - q.quotedAt.getTime() > 900000 ||
      q.quotedAt.getTime() > Date.now() + 60000,
  }));
  const sections: string[] = [];
  const links: { text: string; url: string }[][] = [];
  const candidates: { text: string; distance: string }[] = [];
  const recent: { time: string; text: string }[] = [];
  for (const p of selected) {
    const entries = (await portfolioService(db, userId).entries(p.id)).filter(
      (e) => Date.parse(e.occurredAt) <= Date.now(),
    );
    const ledger = replayLedger(entries);
    const holding = asset
      ? ledger.holdings.find((h) => h.assetId === asset.id)
      : null;
    let lines: string[] = [];
    const base = `${appOrigin()}/portfolios/${p.id}`;
    if (command.kind === "portfolio") {
      const s = valuePortfolio(ledger, catalog, quotes);
      lines = [
        `${s.complete ? "ღირებულება" : "ცნობილი ღირებულება"}: ${money(s.value ?? s.knownValue)}`,
        `სრული P/L: ${money(s.totalPnl)}${s.totalPnl === null ? " · თვითღირებულება ან ფასები უცნობია" : ""}`,
        `USD: ${money(s.cash)}`,
        ...(s.stale ? ["ფასები მოძველებულია"] : []),
      ];
    } else if (command.kind === "position" && holding)
      lines = [`${quantity(holding.quantity)} ${asset.symbol}`];
    else if (command.kind === "sales") {
      const sales = saleResults(entries);
      const sold = entries.filter(
        (e) => e.kind === "sell" && e.assetId === asset.id,
      );
      if (sold.length) {
        const sum = (field: "netProceeds" | "realizedPnl") =>
          sold.some((e) => sales[e.id][field] === null)
            ? null
            : sold
                .reduce(
                  (total, e) => total.plus(sales[e.id][field]!),
                  decimal(0),
                )
                .toFixed();
        lines = [
          `გაყიდული: ${quantity(sold.reduce((s, e) => s.plus(e.quantity), decimal(0)).toFixed())} ${asset.symbol}`,
          `წმინდა მიღებული: ${money(sum("netProceeds"))}`,
          `გაყიდვების P/L: ${money(sum("realizedPnl"))}${sum("realizedPnl") === null ? " · თვითღირებულება უცნობია" : ""}`,
          "მთელი ისტორიის შედეგი",
          ...sold
            .slice(-3)
            .reverse()
            .map(
              (e) =>
                `${dateTime(e.occurredAt)} · ${quantity(e.quantity)} · მიღებული ${money(sales[e.id].netProceeds)} · P/L ${money(sales[e.id].realizedPnl)}`,
            ),
        ];
      }
    } else if (command.kind === "transactions") {
      if (entries.length)
        links.push([
          {
            text: `${p.name.slice(0, 25)} · ტრანზაქციები`,
            url: `${base}/transactions`,
          },
        ]);
      const names: Record<string, string> = {
        buy: "ყიდვა",
        sell: "გაყიდვა",
        deposit: "შეტანა",
        withdrawal: "გატანა",
        fee: "საკომისიო",
        airdrop: "Airdrop",
      };
      for (const e of entries.slice(-5))
        recent.push({
          time: e.occurredAt,
          text: `${p.name.slice(0, 60)} · ${dateTime(e.occurredAt)}\n${names[e.kind]} · ${quantity(e.quantity)} ${catalog.find((a) => a.id === e.assetId)?.symbol ?? e.assetId}${
            e.price !== null
              ? ` · ფასი ${unitPrice(
                  decimal(e.price)
                    .mul(e.settlementRate ?? "1")
                    .toFixed(),
                )}`
              : ""
          }`,
        });
    }
    if (["plan", "alerts", "next"].includes(command.kind)) {
      const plans = await db
        .select()
        .from(exitPlans)
        .where(eq(exitPlans.portfolioId, p.id));
      for (const plan of plans) {
        if (asset && plan.assetId !== asset.id) continue;
        const symbol =
          catalog.find((a) => a.id === plan.assetId)?.symbol ?? plan.assetId;
        const position = ledger.holdings.find(
          (h) => h.assetId === plan.assetId,
        );
        const validPosition = !!position && decimal(position.quantity).gt(0);
        const changed =
          !plan.alertQuantity ||
          !position ||
          !decimal(position.quantity).eq(plan.alertQuantity);
        const levels = await db
          .select()
          .from(exitLevels)
          .where(eq(exitLevels.planId, plan.id))
          .orderBy(asc(exitLevels.level));
        for (const l of levels) {
          const q = quotes.find((q) => q.assetId === plan.assetId);
          const status = l.reachedAt
            ? "მიღწეული"
            : !validPosition
              ? "პოზიცია დახურულია"
              : changed && plan.telegramEnabled
                ? "გეგმა გადასახედია"
                : !plan.telegramEnabled
                  ? "შეტყობინება გამორთულია"
                  : !usableAlertQuote(q)
                    ? "ფასი არასრული/მოძველებულია"
                    : l.alertArmed
                      ? "ელოდება"
                      : "გადაკვეთას ელოდება";
          if (command.kind !== "next")
            lines.push(
              `${symbol} · TP${l.level} · ${unitPrice(l.price)} · ${quantity(l.percentage)}% · ${status}`,
            );
          else if (
            !l.reachedAt &&
            validPosition &&
            !changed &&
            plan.telegramEnabled &&
            usableAlertQuote(q) &&
            decimal(q.price).lt(l.price)
          )
            candidates.push({
              distance: decimal(l.price)
                .minus(q.price)
                .div(q.price)
                .mul(100)
                .toFixed(),
              text: `${p.name.slice(0, 60)} · ${symbol} TP${l.level} · სამიზნე ${unitPrice(l.price)}`,
            });
        }
      }
      if (command.kind !== "plan") {
        const watches = await db
          .select()
          .from(watchlistItems)
          .where(eq(watchlistItems.portfolioId, p.id));
        for (const w of watches)
          for (const direction of ["down", "up"] as const) {
            const price = direction === "down" ? w.entryPrice : w.exitPrice;
            if (!price) continue;
            const reached =
              direction === "down" ? w.targetReachedAt : w.sellTargetReachedAt;
            const armed =
              direction === "down" ? w.targetActive : w.sellTargetActive;
            const q = quotes.find((q) => q.assetId === w.assetId);
            const symbol =
              catalog.find((a) => a.id === w.assetId)?.symbol ?? w.assetId;
            const label = direction === "down" ? "ვარდნა ↓" : "ზრდა ↑";
            const enabled =
              direction === "down"
                ? notificationPreferences.buyEnabled
                : notificationPreferences.sellEnabled;
            if (command.kind === "alerts")
              lines.push(
                `${symbol} · ${label} · ${unitPrice(price)} · ${reached ? "მიღწეული" : !enabled ? "Telegram შეტყობინება გამორთულია" : !usableAlertQuote(q) ? "ფასი არასრული/მოძველებულია" : armed ? "უკვე სამიზნის მხარესაა · ახალ გადაკვეთას ელოდება" : "ელოდება"}`,
              );
            else if (
              !reached &&
              enabled &&
              !armed &&
              (direction === "down" ? w.targetQuoteAt : w.sellTargetQuoteAt) &&
              usableAlertQuote(q) &&
              (direction === "down"
                ? decimal(q.price).gt(price)
                : decimal(q.price).lt(price))
            )
              candidates.push({
                distance: decimal(price)
                  .minus(q.price)
                  .abs()
                  .div(q.price)
                  .mul(100)
                  .toFixed(),
                text: `${p.name.slice(0, 60)} · ${symbol} ${label} · სამიზნე ${unitPrice(price)}`,
              });
          }
      }
    }
    if (lines.length)
      sections.push(
        `${p.name.slice(0, 100)}\n${lines.slice(0, 8).join("\n")}${lines.length > 8 ? `\nკიდევ ${lines.length - 8} · სრული სია აპში` : ""}`,
      );
    if (asset && (holding || lines.length))
      links.push(
        [
          {
            text: `${p.name.slice(0, 25)} · პოზიცია`,
            url: `${base}/positions/${encodeURIComponent(asset.id)}`,
          },
          {
            text: "გეგმა",
            url: `${base}/positions/${encodeURIComponent(asset.id)}?tab=plan`,
          },
        ],
        [{ text: "ტრანზაქციები", url: `${base}/transactions` }],
      );
  }
  if (command.kind === "next")
    sections.push(
      ...candidates
        .sort((a, b) => decimal(a.distance).cmp(b.distance))
        .slice(0, 5)
        .map((c) => `${c.text}\nდარჩენილია ${percentage(c.distance)}`),
    );
  if (command.kind === "transactions")
    sections.push(
      ...recent
        .sort((a, b) => Date.parse(b.time) - Date.parse(a.time))
        .slice(0, 5)
        .map((r) => r.text),
    );
  const empty =
    command.kind === "position"
      ? "არჩეულ ხელით სამართავ პორტფელებში ეს პოზიცია არ არის."
      : command.kind === "sales"
        ? "გაყიდვები არ არის."
        : command.kind === "next"
          ? "ახალი ფასით დადასტურებული მომლოდინე სამიზნე არ არის."
          : "ჩანაწერები არ არის.";
  let body = `${asset ? `${asset.symbol}\n\n` : ""}${sections.length ? sections.join("\n\n") : empty}`;
  if (command.kind === "plan")
    body += "\n\nგეგმაა, არა ბირჟის ორდერი. ავტომატური გაყიდვა არ ხდება.";
  if (command.kind === "next")
    body += "\n\nფასამდე მანძილია, არა მიღწევის ალბათობა.";
  if (command.kind === "alerts")
    body += "\n\nმიღწევა არ ნიშნავს Telegram-ში წარმატებულ მიწოდებას.";
  if (command.kind === "portfolio" || command.kind === "next")
    body += "\nქეშირებული ფასები · ახლდება აპის არსებული გრაფიკით.";
  if (all.length > 10 && !command.portfolio)
    body += "\nპირველი 10 პორტფელი · კონკრეტულის არჩევა: /choose";
  if (body.length > 3900)
    body =
      body.slice(0, 3700).split("\n").slice(0, -1).join("\n") +
      "\nსრული მონაცემები ნახეთ აპში.";
  return {
    body,
    keyboard,
    ...(links.length ? { links: links.slice(0, 6) } : {}),
  };
}
