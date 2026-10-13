export type TelegramCommand =
  { kind: "position" | "plan"; symbol: string } | { kind: "help" };

/** Deliberately bounded grammar: no AI, arbitrary queries or financial writes. */
export function parseTelegramCommand(text: string): TelegramCommand | null {
  const value = text.trim();
  if (/^\/(?:help|start)(?:@[\w]+)?$/i.test(value)) return { kind: "help" };
  const command = /^\/(position|plan)(?:@[\w]+)?\s+([a-z0-9]{1,15})$/i.exec(
    value,
  );
  if (command)
    return {
      kind: command[1].toLowerCase() as "position" | "plan",
      symbol: command[2].toUpperCase(),
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
