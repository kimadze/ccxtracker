export type TelegramCommand = {
  kind:
    | "position"
    | "plan"
    | "sales"
    | "portfolio"
    | "alerts"
    | "history"
    | "next"
    | "transactions"
    | "choose"
    | "help";
  symbol?: string;
  portfolio?: number;
};
/** Bounded read-only grammar; optional portfolio numbers come from /choose. */
export function parseTelegramCommand(text: string): TelegramCommand | null {
  const value = text.trim();
  if (/^\/(?:help|start)(?:@[\w]+)?$/i.test(value)) return { kind: "help" };
  const basic =
    /^\/(portfolio|alerts|history|next|transactions|choose)(?:@[\w]+)?(?:\s+([1-9]\d?))?$/i.exec(
      value,
    );
  if (basic)
    return {
      kind: basic[1].toLowerCase() as TelegramCommand["kind"],
      ...(basic[2] ? { portfolio: Number(basic[2]) } : {}),
    };
  const command =
    /^\/(position|plan|sales)(?:@[\w]+)?\s+([a-z0-9]{1,15})(?:\s+([1-9]\d?))?$/i.exec(
      value,
    );
  if (command)
    return {
      kind: command[1].toLowerCase() as TelegramCommand["kind"],
      symbol: command[2].toUpperCase(),
      ...(command[3] ? { portfolio: Number(command[3]) } : {}),
    };
  const position = /^რამდენი\s+([a-z0-9]{1,15})\s+მაქვს\s*[?？]?$/i.exec(value);
  if (position) return { kind: "position", symbol: position[1].toUpperCase() };
  const plan =
    /^მაჩვენე\s+([a-z0-9]{1,15})(?:-ის|ის)?\s+გაყიდვის\s+გეგმა\s*[?？]?$/i.exec(
      value,
    );
  if (plan) return { kind: "plan", symbol: plan[1].toUpperCase() };
  return null;
}
