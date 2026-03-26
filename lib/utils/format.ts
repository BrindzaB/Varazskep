// Pure formatting utilities — no DB imports.
// Safe to import in both Server and Client components.

// Formats a HUF integer for display: 4990 → "4 990 Ft"
export function formatHuf(amount: number): string {
  return (
    new Intl.NumberFormat("hu-HU", {
      maximumFractionDigits: 0,
    }).format(amount) + " Ft"
  );
}

// Returns the lowest price from a list of variants.
export function getMinPrice(variants: { price: number }[]): number {
  if (variants.length === 0) return 0;
  return Math.min(...variants.map((v) => v.price));
}
