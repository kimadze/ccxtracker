import type { Asset } from "@/domain/types";

const popular = [
  "bitcoin",
  "ethereum",
  "stellar",
  "solana",
  "tether",
  "usd-coin",
];

/** Search the catalogue without letting its database insertion order rank results. */
export function assetSelection(
  assets: Asset[],
  query: string,
  preferredIds: readonly string[] = [],
) {
  const term = query.trim().toLocaleLowerCase();
  const preferred = new Set(preferredIds);
  const unique = [
    ...new Map(assets.map((asset) => [asset.id, asset])).values(),
  ];
  return unique
    .filter(
      (asset) =>
        !term ||
        [asset.symbol, asset.name, asset.id].some((value) =>
          value.toLocaleLowerCase().includes(term),
        ),
    )
    .sort((a, b) => {
      const score = (asset: Asset) => {
        const symbol = asset.symbol.toLocaleLowerCase();
        const name = asset.name.toLocaleLowerCase();
        if (term) {
          if (symbol === term || asset.id.toLocaleLowerCase() === term)
            return 0;
          if (name === term) return 1;
          if (symbol.startsWith(term)) return 2;
          if (name.startsWith(term)) return 3;
          return 4;
        }
        if (preferred.has(asset.id)) return 0;
        const index = popular.indexOf(asset.id);
        return index < 0 ? 100 : index + 1;
      };
      return (
        score(a) - score(b) ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id)
      );
    });
}
