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

// A4 in centimetres. An object is "large" if it exceeds A4 in EITHER dimension —
// comparing areas would let a wide, short line of text stay in the cheap tier forever.
export const A4_WIDTH_CM = 21;
export const A4_HEIGHT_CM = 29.7;

export interface PrintFees {
  smallHuf: number; // both dimensions within A4
  largeHuf: number; // either dimension exceeds A4
}

// Raised when an object carries no usable geometry. Charging a default here would be a
// free-ride path (strip the dimensions, get the cheap tier), so the checkout rejects instead.
export const PRINT_FEE_UNRESOLVABLE = "PRINT_FEE_UNRESOLVABLE";

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

export function isLargeObject(size: { wCm: number; hCm: number }): boolean {
  return size.wCm > A4_WIDTH_CM || size.hCm > A4_HEIGHT_CM;
}

/**
 * Total print fee for a design, summed over every object on both sides.
 *
 * Throws PRINT_FEE_UNRESOLVABLE if any object's geometry cannot be read — the caller
 * turns that into a rejected checkout rather than guessing a price.
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
    total += isLargeObject(size) ? fees.largeHuf : fees.smallHuf;
  }
  return total;
}
