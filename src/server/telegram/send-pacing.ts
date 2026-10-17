import "server-only";

/** Per-instance pacing; Telegram 429/retry_after remains the cross-instance backstop. */
export function createTelegramPacer(
  now = () => Date.now(),
  sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms)),
) {
  let globalNext = 0;
  const chats = new Map<string, number>();
  return async (chatId: string) => {
    const time = now();
    const slot = Math.max(time, globalNext, chats.get(chatId) ?? 0);
    globalNext = slot + 50;
    chats.delete(chatId);
    chats.set(chatId, slot + 1000);
    // Bound process memory; IDs never appear in logs or persistent health data.
    if (chats.size > 10000) chats.delete(chats.keys().next().value!);
    if (slot > time) await sleep(slot - time);
  };
}
export const waitForTelegramSlot = createTelegramPacer();
