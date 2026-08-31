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
import { getMalfiniCostMap } from "@/lib/malfini/client";
import { makeEurToHufConverter } from "@/lib/malfini/pricing";
import {
  computeGrossPrice,
  profitPerPieceHuf,
  realisedMarkupPct,
} from "./compute";
import { getPricingSettings, type PricingSettings } from "./settings";

// Loads the settings, then the cost map built with the configured exchange rate.
// Sequential by necessity — the rate is an input to the cost map.
async function loadInputs(): Promise<{
  settings: PricingSettings;
  costMap: Record<string, number>;
}> {
  const settings = await getPricingSettings();
  const costMap = await getMalfiniCostMap(
    makeEurToHufConverter(settings.eurHufRate)
  );
  return { settings, costMap };
}

export interface MalfiniPriceDetail {
  grossHuf: number; // customer-facing price
  costNetHuf: number; // net purchase price from Malfini
  // Árrés actually realised: (net selling price − cost) / cost. Differs slightly from
  // the configured markup because the gross price is snapped to the price grid.
  markupPct: number;
  profitHuf: number; // net revenue minus cost, per piece
}

// Restricts the (large) catalog-wide cost map to the SKUs a caller actually needs,
// so page props never carry ~17k unrelated entries into the RSC payload.
function pickCosts(
  costMap: Record<string, number>,
  skus: string[]
): Array<[string, number]> {
  const out: Array<[string, number]> = [];
  for (const sku of Array.from(new Set(skus))) {
    const cost = costMap[sku];
    if (typeof cost === "number" && cost > 0) out.push([sku, cost]);
  }
  return out;
}

/**
 * Malfini SKU → gross selling price, for the given SKUs.
 *
 * SKUs with no known purchase price are omitted rather than defaulted: callers
 * already treat a missing entry as "price unavailable", and inventing a price is
 * how a product ends up sold below cost. (Measured 2026-08-31: all 11 143
 * sellable SKUs in the designer categories have a purchase price.)
 */
export async function getMalfiniPriceMap(
  skus: string[]
): Promise<Record<string, number>> {
  if (skus.length === 0) return {};
  const { settings, costMap } = await loadInputs();
  return Object.fromEntries(
    pickCosts(costMap, skus).map(([sku, cost]) => [
      sku,
      grossFor(cost, settings),
    ])
  );
}

// Same resolution, with the inputs the admin needs to judge whether a price is sane.
export async function getMalfiniPriceDetails(
  skus: string[]
): Promise<Record<string, MalfiniPriceDetail>> {
  if (skus.length === 0) return {};
  const { settings, costMap } = await loadInputs();
  return Object.fromEntries(
    pickCosts(costMap, skus).map(([sku, cost]) => {
      const grossHuf = grossFor(cost, settings);
      return [
        sku,
        {
          grossHuf,
          costNetHuf: cost,
          markupPct: realisedMarkupPct(grossHuf, cost, settings.vatPct),
          profitHuf: profitPerPieceHuf(grossHuf, cost, settings.vatPct),
        },
      ];
    })
  );
}

function grossFor(costNetHuf: number, settings: PricingSettings): number {
  return computeGrossPrice(costNetHuf, {
    markupPct: settings.malfiniMarkupPct,
    vatPct: settings.vatPct,
    roundGridHuf: settings.roundGridHuf,
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
