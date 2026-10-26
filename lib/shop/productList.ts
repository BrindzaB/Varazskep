// Pure helpers for the Termékek page list: search matching and ordering. No React, so
// they are unit-testable and shared by any list that needs the same behaviour.

/** Lowercase, accent-free form for matching: "Bögre" and "bogre" compare equal. */
export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Whether every word of the query occurs in at least one of the fields. Word-wise, so
 * "fekete póló" finds a product whose name has "póló" and whose category has "fekete".
 * An empty query matches everything.
 */
export function matchesSearch(fields: string[], query: string): boolean {
  const words = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = fields.map(normalizeForSearch).join(" ");
  return words.every((word) => haystack.includes(word));
}

const huCollator = new Intl.Collator("hu", { sensitivity: "base", numeric: true });

/** Hungarian alphabetical order — "Ö" after "O", "Cs" handled, numbers numerically. */
export function compareNamesHu(a: string, b: string): number {
  return huCollator.compare(a, b);
}

export type ProductSort = "name" | "price-asc" | "price-desc";

/**
 * Sorts by name, or by price with name as the tie-breaker. Items without a price (0)
 * go last either way — they are not "free", their price is just unknown here.
 */
export function sortProducts<T>(
  items: T[],
  sort: ProductSort,
  nameOf: (item: T) => string,
  priceOf: (item: T) => number
): T[] {
  return [...items].sort((a, b) => {
    if (sort !== "name") {
      const pa = priceOf(a);
      const pb = priceOf(b);
      if (pa > 0 !== pb > 0) return pa > 0 ? -1 : 1;
      if (pa !== pb) return sort === "price-asc" ? pa - pb : pb - pa;
    }
    return compareNamesHu(nameOf(a), nameOf(b));
  });
}
