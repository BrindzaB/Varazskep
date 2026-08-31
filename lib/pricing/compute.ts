// Pure pricing arithmetic — no DB, no network, no env access.
// Unit-tested in __tests__/pricing.test.ts.
//
// Why every supplier figure is NET: Malfini invoices this account under the EU
// reverse-charge scheme (verified on invoice 26F1HU0100027073 — `vatRate: 0`,
// `vatCode: "PEZ00"`), so no VAT ever appears in their data. Hungarian VAT is our
// own liability on the sale, which is why it is added here rather than assumed
// to be baked into the supplier price.

export interface PriceFormula {
  markupPct: number; // markup applied to the net supplier cost
  vatPct: number; // VAT added on top of the marked-up net price
  roundGridHuf: number; // price grid for the final gross price (see roundToPriceGrid)
}

/**
 * Snaps a gross price onto the shop's "…99" price grid.
 *
 * Allowed price points sit one forint below each multiple of `gridHuf`, so a grid
 * of 100 permits 99, 199, … 1999, 2099. The remainder decides the direction: up to
 * and including half the grid we round DOWN, above it UP — at grid 100 exactly the
 * shop's rule, "50-ig lefelé, utána felfelé".
 *
 *   1981.2 → 1999    (remainder 81 → up)
 *   2045   → 1999    (remainder 45 → down)
 *   2060   → 2099    (remainder 60 → up)
 *
 * A coarser grid looks tidier but distorts the margin, because its error is a fixed
 * number of forints against a variable price. Measured over all 11 141 sellable SKUs
 * at a 30% markup: a 100 Ft grid holds the realised margin within 25.9–38.3%, while
 * a 500 Ft grid (…499/…999) spreads it across 4.9–72.9% and leaves 1912 SKUs under
 * 25%. Hence 100 is the default.
 */
export function roundToPriceGrid(value: number, gridHuf: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (gridHuf <= 1) return Math.round(value);
  const base = Math.floor(value / gridHuf) * gridHuf;
  const remainder = value - base;
  const rounded = remainder <= gridHuf / 2 ? base - 1 : base + gridHuf - 1;
  // Never fall below the cheapest point the grid allows.
  return Math.max(gridHuf - 1, rounded);
}

// Net supplier cost → customer-facing gross price.
export function computeGrossPrice(costNetHuf: number, f: PriceFormula): number {
  if (!Number.isFinite(costNetHuf) || costNetHuf <= 0) return 0;
  const markedUpNet = costNetHuf * (1 + f.markupPct / 100);
  return roundToPriceGrid(markedUpNet * (1 + f.vatPct / 100), f.roundGridHuf);
}

// The VAT-excluded revenue we keep from a gross sale price.
export function netRevenue(grossHuf: number, vatPct: number): number {
  return grossHuf / (1 + vatPct / 100);
}

/**
 * The markup actually realised on a price, as a percentage of cost.
 *
 * This is "árrés" as the shop uses the word: the difference between the net selling
 * price and the purchase price, measured against the purchase price. It can differ
 * from the configured markup because the gross price is snapped to the price grid —
 * so this is the number to show an admin who wants to know what a product really earns.
 */
export function realisedMarkupPct(
  grossHuf: number,
  costNetHuf: number,
  vatPct: number
): number {
  if (costNetHuf <= 0) return 0;
  return ((netRevenue(grossHuf, vatPct) - costNetHuf) / costNetHuf) * 100;
}

// Profit per piece in HUF: net revenue minus what we paid the supplier.
export function profitPerPieceHuf(
  grossHuf: number,
  costNetHuf: number,
  vatPct: number
): number {
  return netRevenue(grossHuf, vatPct) - costNetHuf;
}
