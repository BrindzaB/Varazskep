// The "Népszerű termékek" list mixes Malfini and local products in one ordered list, so
// each entry is a typed key: "malfini:<code>" | "local:<productId>". Pure — no DB access.

export const MAX_POPULAR_PRODUCTS = 5;

export type PopularKey =
  | { source: "malfini"; code: string }
  | { source: "local"; productId: string };

export function popularKey(ref: PopularKey): string {
  return ref.source === "malfini"
    ? `malfini:${ref.code}`
    : `local:${ref.productId}`;
}

/** Parses a stored/submitted key; null when malformed. */
export function parsePopularKey(key: string): PopularKey | null {
  const match = /^(malfini|local):(.+)$/.exec(key);
  if (!match) return null;
  return match[1] === "malfini"
    ? { source: "malfini", code: match[2] }
    : { source: "local", productId: match[2] };
}
