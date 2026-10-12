import type { TransactionKind } from "./types";
export const kindLabels: Record<TransactionKind, string> = {
  buy: "შესყიდვა",
  sell: "გაყიდვა",
  deposit: "შეტანა",
  withdrawal: "გატანა",
  fee: "საკომისიო",
  airdrop: "Airdrop მიღება",
};
