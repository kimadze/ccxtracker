import type { Asset, LedgerEntry } from "@/domain/types";
import { dateTime, quantity, unitPrice } from "@/lib/formatters";
import { BalanceValue } from "./ui";

const labels: Record<LedgerEntry["kind"], string> = {
  buy: "შეძენა",
  sell: "გაყიდვა",
  deposit: "შეტანა",
  withdrawal: "გატანა",
  fee: "საკომისიო",
  airdrop: "Airdrop",
};

export function OverviewTransactions({
  entries,
  assets,
}: {
  entries: LedgerEntry[];
  assets: Asset[];
}) {
  const recent = [...entries]
    .sort(
      (a, b) =>
        Date.parse(b.occurredAt) - Date.parse(a.occurredAt) ||
        b.sequence - a.sequence,
    )
    .slice(0, 6);
  const symbol = (entry: LedgerEntry) =>
    assets.find((asset) => asset.id === entry.assetId)?.symbol ?? entry.assetId;
  const price = (entry: LedgerEntry) =>
    entry.settlementAssetId && entry.settlementAssetId !== "USD"
      ? `${entry.price === null ? "—" : quantity(entry.price)} ${assets.find((asset) => asset.id === entry.settlementAssetId)?.symbol ?? entry.settlementAssetId}`
      : unitPrice(entry.price);
  return (
    <div
      className="card card-border min-w-0 border-base-300 bg-base-200"
      data-testid="overview-recent-transactions"
    >
      <ul className="list lg:hidden">
        {recent.map((entry) => (
          <li
            key={entry.id}
            className="list-row flex min-h-[68px] items-center justify-between gap-3 rounded-none border-b border-base-300 px-3 py-2.5 last:border-0"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {symbol(entry)}{" "}
                <span className="ml-1 text-xs font-normal text-base-content/60">
                  {labels[entry.kind]}
                </span>
              </p>
              <p className="mt-1 text-xs text-base-content/50">
                {dateTime(entry.occurredAt)}
              </p>
            </div>
            <div className="min-w-0 overflow-x-auto whitespace-nowrap text-right text-sm tabular-nums">
              <BalanceValue>{quantity(entry.quantity)}</BalanceValue>
              <span className="ml-1 text-xs text-base-content/50">
                {symbol(entry)}
              </span>
            </div>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto lg:block">
        <table className="table table-sm w-full text-xs [&_th]:px-3 [&_td]:px-3 [&_td]:py-3.5">
          <thead>
            <tr>
              <th>თარიღი</th>
              <th>ტიპი</th>
              <th>აქტივი</th>
              <th className="text-right">რაოდენობა</th>
              <th className="text-right">ერთეულის ფასი</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((entry) => (
              <tr key={entry.id}>
                <td className="whitespace-nowrap text-base-content/60">
                  {dateTime(entry.occurredAt)}
                </td>
                <td>{labels[entry.kind]}</td>
                <td className="font-semibold">{symbol(entry)}</td>
                <td className="whitespace-nowrap text-right tabular-nums">
                  <BalanceValue>{quantity(entry.quantity)}</BalanceValue>
                </td>
                <td className="whitespace-nowrap text-right tabular-nums text-base-content/60">
                  <BalanceValue>{price(entry)}</BalanceValue>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!recent.length && (
        <p className="px-4 py-5 text-sm text-base-content/55">
          ტრანზაქციები ჯერ არ არის
        </p>
      )}
    </div>
  );
}
