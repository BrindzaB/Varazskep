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
  endings: number[]; // permitted last-two-digit price endings (see roundToEndings)
}

// How to pick between the two neighbouring permitted prices.
export type RoundingMode =
  // Closest permitted price; an exact tie goes down.
  | "nearest"
  // The first permitted price at or above the value. Used where rounding down would
  // put the price under our own cost — see lib/kvikk/pricing.ts.
  | "up";

/**
 * Snaps a gross price onto the shop's permitted price endings.
 *
 * `endings` lists the allowed last-two-digit values within each 100 Ft block, so [90]
 * permits 90, 190, 290 … and [50, 90] permits 50, 90, 150, 190, 250, 290 …
 *
 *   roundToEndings(1981.2, [90])           → 1990
 *   roundToEndings(2045,   [90])           → 2090   (2045 is nearer 2090 than 1990)
 *   roundToEndings(1473,   [50, 90], "up") → 1490
 *
 * Coarser endings look tidier but distort the margin, because the error is a fixed
 * number of forints against a variable price. Measured over all 11 136 sellable SKUs at
 * a 30% árrés: [90] holds the realised árrés at 24.9–36.7% (median 29.8%), whereas
 * 500 Ft steps spread it across 4.9–72.9% and leave 1912 SKUs under 25%.
 */
export function roundToEndings(
  value: number,
  endings: number[],
  mode: RoundingMode = "nearest"
): number {
  if (!Number.isFinite(value) || value <= 0) return 0;

  const valid = endings
    .filter((e) => Number.isInteger(e) && e >= 0 && e <= 99)
    .sort((a, b) => a - b);
  if (valid.length === 0) return Math.round(value);

  // One block either side covers every neighbour of a value inside the middle block.
  const base = Math.floor(value / 100) * 100;
  const candidates: number[] = [];
  for (const offset of [-100, 0, 100]) {
    for (const ending of valid) {
      const candidate = base + offset + ending;
      if (candidate > 0) candidates.push(candidate);
    }
  }
  candidates.sort((a, b) => a - b);

  if (mode === "up") {
    // The +100 block guarantees a candidate at or above any value in the base block.
    return (
      candidates.find((c) => c >= value) ?? candidates[candidates.length - 1]
    );
  }

  // Ascending order means an exact tie keeps the lower candidate.
  let best = candidates[0];
  for (const c of candidates) {
    if (Math.abs(value - c) < Math.abs(value - best)) best = c;
  }
  return best;
}

// Net supplier cost → customer-facing gross price.
export function computeGrossPrice(costNetHuf: number, f: PriceFormula): number {
  if (!Number.isFinite(costNetHuf) || costNetHuf <= 0) return 0;
  const markedUpNet = costNetHuf * (1 + f.markupPct / 100);
  return roundToEndings(markedUpNet * (1 + f.vatPct / 100), f.endings);
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

// ── Endings serialisation ────────────────────────────────────────────────────
// Kept here rather than in ./settings.ts so client components (the admin pricing form)
// can use them: settings.ts imports prisma, which drags Node built-ins into the bundle.

// Endings are stored as a comma-separated string, e.g. "50,90".
export function formatEndings(endings: number[]): string {
  return endings.join(",");
}

/**
 * Parses "50,90" (or an array of numbers) into a sorted, de-duplicated list.
 * Returns null when the input is unusable, so callers can decide between falling back
 * to a default (on read) and reporting an error (on write).
 */
export function parseEndings(raw: unknown): number[] | null {
  const parts: unknown[] = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(",")
      : [];
  if (parts.length === 0 || parts.length > 10) return null;

  const out = new Set<number>();
  for (const part of parts) {
    // A blank entry ("" or a trailing comma) must be rejected, not read as 0:
    // Number("") is 0, which would silently turn "" into the …00 ending.
    if (typeof part === "string" && part.trim() === "") return null;
    const value = typeof part === "string" ? Number(part.trim()) : Number(part);
    if (!Number.isInteger(value) || value < 0 || value > 99) return null;
    out.add(value);
  }
  if (out.size === 0) return null;
  return Array.from(out).sort((a, b) => a - b);
}
