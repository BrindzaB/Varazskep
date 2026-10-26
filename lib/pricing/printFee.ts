// Server-side print fee calculation — the authoritative figure charged at checkout.
//
// The designer computes the same number client-side for immediate feedback
// (components/designer/DesignerCanvas.tsx), but the client's figure is never trusted:
// before this module the browser simply posted a `printFee` and the server accepted any
// multiple of 500 — omitting the field altogether bought free printing.
//
// Every input here is either server-held config (the print area, the fees) or the design
// geometry itself. Geometry is client-authored by nature — it *is* the design — but it is
// the same geometry that gets printed, so shrinking it to reach the cheap tier also shrinks
// the delivered artwork. The per-object `_wCm`/`_hCm` fields the designer stores alongside
// are deliberately NOT used: those could be understated while leaving the print large.

import type { PrintArea, PrintSizeCm } from "@/lib/designer/mockupConfig";
import type { CanvasJson } from "@/lib/services/design";

// Print tiers, as sheet sizes in centimetres (short side × long side). An object belongs
// to the smallest sheet it fits on, in either orientation — a wide logo lying across an
// A4 sheet is still A4. Comparing dimensions, not areas: area would let a long, thin line
// of text stay in the cheap tier forever. Nothing may exceed A3.
export interface PrintSheetCm {
  shortCm: number;
  longCm: number;
}

export const PRINT_SHEETS = {
  small: { shortCm: 10, longCm: 10 },
  a4: { shortCm: 21, longCm: 29.7 },
  a3: { shortCm: 29.7, longCm: 42 },
} as const satisfies Record<string, PrintSheetCm>;

export type PrintTier = keyof typeof PRINT_SHEETS;

export interface PrintFees {
  smallHuf: number; // fits on 10×10 cm
  a4Huf: number; // fits on A4
  a3Huf: number; // fits on A3 — the largest printable size
}

// Raised when an object carries no usable geometry. Charging a default here would be a
// free-ride path (strip the dimensions, get the cheap tier), so the checkout rejects instead.
export const PRINT_FEE_UNRESOLVABLE = "PRINT_FEE_UNRESOLVABLE";

// Raised when an object is larger than A3. The designer stops scaling at A3, so only a
// tampered design reaches the checkout like this.
export const PRINT_FEE_OVERSIZE = "PRINT_FEE_OVERSIZE";

// The A3 cap is checked against the stored design, whose numbers Fabric rounds when it
// serializes — an object the designer held at exactly A3 can come back a hair over.
// 0.5% (2 mm on A3's long side) absorbs that without allowing a meaningfully larger print.
const OVERSIZE_TOLERANCE = 1.005;

interface GeometryJson {
  width?: unknown;
  height?: unknown;
  scaleX?: unknown;
  scaleY?: unknown;
}

function finitePositive(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function finiteScale(value: unknown): number | null {
  // A scale of 0 collapses the object to nothing; treat it as malformed rather than free.
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

/**
 * Real-world size of one serialized Fabric object, in centimetres.
 * Returns null when the object carries no usable width/height/scale.
 */
export function objectSizeCm(
  obj: unknown,
  printArea: PrintArea,
  printAreaCm: PrintSizeCm
): { wCm: number; hCm: number } | null {
  if (!obj || typeof obj !== "object") return null;
  const g = obj as GeometryJson;

  const width = finitePositive(g.width);
  const height = finitePositive(g.height);
  const scaleX = finiteScale(g.scaleX ?? 1);
  const scaleY = finiteScale(g.scaleY ?? 1);
  if (width === null || height === null || scaleX === null || scaleY === null) {
    return null;
  }

  // Same conversion the designer uses: canvas pixels → cm via the print area.
  return {
    wCm: width * scaleX * (printAreaCm.width / printArea.width),
    hCm: height * scaleY * (printAreaCm.height / printArea.height),
  };
}

/** Whether an object fits on a sheet, in either orientation. */
export function fitsSheet(
  size: { wCm: number; hCm: number },
  sheet: PrintSheetCm,
  tolerance = 1
): boolean {
  const shortSide = Math.min(size.wCm, size.hCm);
  const longSide = Math.max(size.wCm, size.hCm);
  return (
    shortSide <= sheet.shortCm * tolerance &&
    longSide <= sheet.longCm * tolerance
  );
}

/**
 * The print tier of an object, or null if it is larger than A3. Without a tolerance this
 * is the designer's view; the checkout passes OVERSIZE_TOLERANCE via computePrintFeeHuf.
 */
export function printTierOf(
  size: { wCm: number; hCm: number },
  oversizeTolerance = 1
): PrintTier | null {
  if (fitsSheet(size, PRINT_SHEETS.small)) return "small";
  if (fitsSheet(size, PRINT_SHEETS.a4)) return "a4";
  if (fitsSheet(size, PRINT_SHEETS.a3, oversizeTolerance)) return "a3";
  return null;
}

export function feeForTier(tier: PrintTier, fees: PrintFees): number {
  switch (tier) {
    case "small":
      return fees.smallHuf;
    case "a4":
      return fees.a4Huf;
    case "a3":
      return fees.a3Huf;
  }
}

/**
 * The largest uniform scale factor that brings an object down to A3, or 1 if it already
 * fits. The designer multiplies the object's scale by this to cap it.
 */
export function scaleToFitA3(size: { wCm: number; hCm: number }): number {
  const shortSide = Math.min(size.wCm, size.hCm);
  const longSide = Math.max(size.wCm, size.hCm);
  return Math.min(
    1,
    PRINT_SHEETS.a3.shortCm / shortSide,
    PRINT_SHEETS.a3.longCm / longSide
  );
}

/**
 * Total print fee for a design, summed over every object on both sides.
 *
 * Throws PRINT_FEE_UNRESOLVABLE if any object's geometry cannot be read, and
 * PRINT_FEE_OVERSIZE if any object is larger than A3 — the caller turns either into a
 * rejected checkout rather than guessing a price.
 */
export function computePrintFeeHuf(
  canvasJson: CanvasJson,
  printArea: PrintArea,
  printAreaCm: PrintSizeCm,
  fees: PrintFees
): number {
  const front = Array.isArray(canvasJson.front) ? canvasJson.front : [];
  const back = Array.isArray(canvasJson.back) ? canvasJson.back : [];

  let total = 0;
  for (const obj of [...front, ...back]) {
    const size = objectSizeCm(obj, printArea, printAreaCm);
    if (size === null) throw new Error(PRINT_FEE_UNRESOLVABLE);
    const tier = printTierOf(size, OVERSIZE_TOLERANCE);
    if (tier === null) throw new Error(PRINT_FEE_OVERSIZE);
    total += feeForTier(tier, fees);
  }
  return total;
}
