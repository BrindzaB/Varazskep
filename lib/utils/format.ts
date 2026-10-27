// Pure formatting utilities — no DB imports.
// Safe to import in both Server and Client components.

// Formats a HUF integer for display: 4990 → "4 990 Ft", 12990 → "12 990 Ft".
// Grouped by hand because Intl's hu-HU format leaves four-digit numbers ungrouped
// ("4990" next to "12 990"). The separators are non-breaking spaces so a price never wraps.
export function formatHuf(amount: number): string {
  const digits = String(Math.abs(Math.round(amount))).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    " "
  );
  return `${amount < 0 ? "-" : ""}${digits} Ft`;
}

// Returns the lowest price from a list of variants.
export function getMinPrice(variants: { price: number }[]): number {
  if (variants.length === 0) return 0;
  return Math.min(...variants.map((v) => v.price));
}
