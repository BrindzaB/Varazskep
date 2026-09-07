// Single entry point for every customer-facing product price.
//
// Before this module the storefront, the designer, the admin and the checkout each
// called buildPriceMap() on Malfini's recommended prices independently, so pricing
// policy lived in five places and could not be changed without a deploy. Everything
// now resolves here, from admin-editable settings.
//
// Local products: Variant.price is the admin-entered gross price — used verbatim.
// Malfini products: net purchase price × markup × VAT, rounded (see compute.ts).

import { prisma } from "@/lib/db";
import {
  findMalfiniProductBySku,
  getMalfiniCostMap,
} from "@/lib/malfini/client";
import { getCategoryConfig } from "@/lib/malfini/categoryConfig";
import {
  getMockupConfig,
  type PrintArea,
  type PrintSizeCm,
} from "@/lib/designer/mockupConfig";
import type { CanvasJson } from "@/lib/services/design";
import { computePrintFeeHuf, PRINT_FEE_UNRESOLVABLE } from "./printFee";
import { makeEurToHufConverter } from "@/lib/malfini/pricing";
import {
  computeGrossPrice,
  profitPerPieceHuf,
  realisedMarkupPct,
} from "./compute";
import { getPricingSettings, type PricingSettings } from "./settings";
import { getPriceOverrideMap } from "./overrides";

// Loads everything the resolution chain needs. The settings come first because the
// exchange rate is an input to the cost map; the overrides are independent.
async function loadInputs(skus: string[]): Promise<{
  settings: PricingSettings;
  costMap: Record<string, number>;
  overrides: Record<string, number>;
}> {
  const settings = await getPricingSettings();
  const [costMap, overrides] = await Promise.all([
    getMalfiniCostMap(makeEurToHufConverter(settings.eurHufRate)),
    getPriceOverrideMap(skus),
  ]);
  return { settings, costMap, overrides };
}

/**
 * The resolution chain for one SKU: a manual override wins, otherwise the árrés rule
 * applies to the purchase cost. Returns null only when neither is available.
 */
function resolveOne(
  sku: string,
  costMap: Record<string, number>,
  overrides: Record<string, number>,
  settings: PricingSettings
): MalfiniPriceDetail | null {
  const rawCost = costMap[sku];
  const costNetHuf =
    typeof rawCost === "number" && rawCost > 0 ? rawCost : null;
  const computedHuf =
    costNetHuf === null ? null : grossFor(costNetHuf, settings);

  const override = overrides[sku];
  const hasOverride = typeof override === "number" && override > 0;

  const grossHuf = hasOverride ? override : computedHuf;
  if (grossHuf === null) return null;

  return {
    grossHuf,
    costNetHuf,
    computedHuf,
    origin: hasOverride ? "override" : "computed",
    markupPct:
      costNetHuf === null
        ? null
        : realisedMarkupPct(grossHuf, costNetHuf, settings.vatPct),
    profitHuf:
      costNetHuf === null
        ? null
        : profitPerPieceHuf(grossHuf, costNetHuf, settings.vatPct),
  };
}

export interface MalfiniPriceDetail {
  grossHuf: number; // customer-facing price
  // Net purchase price from Malfini. Null when Malfini has no price for the SKU but an
  // admin set one by hand — the item is still sellable, the margin just isn't known.
  costNetHuf: number | null;
  // Árrés actually realised: (net selling price − cost) / cost. Differs from the
  // configured árrés because the gross price is snapped to the price grid, and is
  // arbitrary on an override. Null when the cost is unknown.
  markupPct: number | null;
  profitHuf: number | null; // net revenue minus cost, per piece
  // Where grossHuf came from. "override" means an admin set it and the árrés setting
  // does not apply; the admin UI shows the computed price alongside for comparison.
  origin: "override" | "computed";
  // The price the árrés rule would produce, so an override can be compared and reverted.
  computedHuf: number | null;
}

/**
 * Malfini SKU → gross selling price, for the given SKUs.
 *
 * A SKU that resolves to neither an override nor a cost is omitted rather than
 * defaulted: callers already treat a missing entry as "price unavailable", and
 * inventing a price is how a product ends up sold below cost. (Measured 2026-08-31:
 * all 11 141 sellable SKUs in the designer categories have a purchase price.)
 */
export async function getMalfiniPriceMap(
  skus: string[]
): Promise<Record<string, number>> {
  const details = await getMalfiniPriceDetails(skus);
  return Object.fromEntries(
    Object.entries(details).map(([sku, d]) => [sku, d.grossHuf])
  );
}

// Same resolution, with the inputs the admin needs to judge whether a price is sane.
export async function getMalfiniPriceDetails(
  skus: string[]
): Promise<Record<string, MalfiniPriceDetail>> {
  if (skus.length === 0) return {};
  const unique = Array.from(new Set(skus));
  const { settings, costMap, overrides } = await loadInputs(unique);

  const out: Record<string, MalfiniPriceDetail> = {};
  for (const sku of unique) {
    const detail = resolveOne(sku, costMap, overrides, settings);
    if (detail) out[sku] = detail;
  }
  return out;
}

function grossFor(costNetHuf: number, settings: PricingSettings): number {
  return computeGrossPrice(costNetHuf, {
    markupPct: settings.malfiniMarkupPct,
    vatPct: settings.vatPct,
    endings: settings.priceEndings,
  });
}

/**
 * Authoritative gross price for one local variant, straight from the DB.
 * Lives here so the checkout resolves both product sources through one module;
 * local prices are admin-entered gross figures and get no markup applied.
 */
export async function resolveLocalVariantPrice(
  variantId: string
): Promise<number | null> {
  const variant = await prisma.variant.findUnique({
    where: { id: variantId },
    select: { price: true },
  });
  return variant?.price ?? null;
}

// ── Print fee ────────────────────────────────────────────────────────────────

/** Identifies the product a designed cart item belongs to, for the print area lookup. */
export type PrintFeeRef =
  | { source: "local"; variantId: string; designId: string }
  | { source: "malfini"; productSizeCode: string; designId: string };

/**
 * Authoritative print fee for one designed cart item, in gross HUF.
 *
 * Resolves the print area from server-held config — the local product's `mockupType`
 * via the DB, or the Malfini product found by scanning the catalog for the SKU. The
 * `productCode` a client sends is deliberately ignored: it is a separate field from
 * the SKU, so trusting it would let a request pair an expensive garment with a mug's
 * (much smaller) print area and land every object in the cheap tier.
 *
 * Returns null when the item cannot be priced — no design row, no designer template,
 * or unreadable geometry. Callers must reject the checkout rather than charge 0.
 */
export async function resolvePrintFeeHuf(
  ref: PrintFeeRef
): Promise<number | null> {
  const design = await prisma.design.findUnique({
    where: { id: ref.designId },
    select: { canvasJson: true },
  });
  if (!design?.canvasJson) {
    console.error(`[pricing] print fee: design ${ref.designId} not found`);
    return null;
  }

  const area = await resolvePrintArea(ref);
  if (!area) {
    console.error(
      `[pricing] print fee: no designer template for ${JSON.stringify(ref)}`
    );
    return null;
  }

  const settings = await getPricingSettings();

  try {
    return computePrintFeeHuf(
      design.canvasJson as unknown as CanvasJson,
      area.printArea,
      area.printAreaCm,
      {
        smallHuf: settings.printFeeSmallHuf,
        largeHuf: settings.printFeeLargeHuf,
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === PRINT_FEE_UNRESOLVABLE) {
      console.error(
        `[pricing] print fee: unreadable object geometry in design ${ref.designId}`
      );
      return null;
    }
    throw err;
  }
}

async function resolvePrintArea(
  ref: PrintFeeRef
): Promise<{ printArea: PrintArea; printAreaCm: PrintSizeCm } | null> {
  if (ref.source === "local") {
    const variant = await prisma.variant.findUnique({
      where: { id: ref.variantId },
      select: { product: { select: { mockupType: true } } },
    });
    const config = getMockupConfig(variant?.product.mockupType ?? null);
    return config
      ? { printArea: config.printArea, printAreaCm: config.printAreaCm }
      : null;
  }

  const product = await findMalfiniProductBySku(ref.productSizeCode);
  if (!product) return null;
  const config = getCategoryConfig(product.categoryCode);
  return config
    ? { printArea: config.printArea, printAreaCm: config.printAreaCm }
    : null;
}
