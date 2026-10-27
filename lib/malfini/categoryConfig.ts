// Maps Malfini products to storefront categories and designer configuration.
// A product without a designer config is not sold: it is hidden from the Termékek page,
// the designer, the admin pickers and the sitemap.
//
// Clothing is configured per Malfini categoryCode. Malfini lumps every bag into a single
// "bags" category, so bags are picked one by one (BAG_CATEGORY_BY_CODE): only the listed
// products are sold, each under its own storefront category. A bag Malfini adds later
// stays hidden until it is listed here — its photo needs its own print area anyway.
//
// Print area dimensions are in canvas pixels (canvas is 500×600; the product photo is
// scaled to 95% of the tighter dimension and centred — see DesignerCanvas.tsx). For the
// 400×453 Malfini photos that is a 1.1875× scale with the photo's top-left at (12.5, 31).

import type { PrintArea, PrintSizeCm } from "@/lib/designer/mockupConfig";

export interface CategoryConfig {
  printArea: PrintArea;
  // Real print area size in cm — garments use the full t-shirt area (38×48).
  printAreaCm: PrintSizeCm;
  hasSides: boolean; // true = front/back toggle shown in the designer
}

// Storefront category for each bag we sell, keyed by 3-char Malfini product code.
const BAG_CATEGORY_BY_CODE: Record<string, string> = {
  "912": "gym-bags", // Energy — polyester drawstring bag, 34×45 cm
  "921": "tote-bags", // Shopper — cotton tote, 40×45 cm
};

export const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  "t-shirts": {
    printArea: { width: 220, height: 300, centerX: 250, centerY: 300 },
    printAreaCm: { width: 38, height: 48 },
    hasSides: true,
  },
  "sweatshirts": {
    printArea: { width: 220, height: 300, centerX: 252, centerY: 300 },
    printAreaCm: { width: 38, height: 48 },
    hasSides: true,
  },
  "polo-shirts": {
    // Slightly narrower and shorter than t-shirts due to the collar and button placket
    printArea: { width: 200, height: 300, centerX: 250, centerY: 310 },
    printAreaCm: { width: 38, height: 48 },
    hasSides: true,
  },
  "gym-bags": {
    // The drawstring gathers the top third, so the area sits on the flat lower body:
    // photo x 122–263, y 218–405 (~5.7 px/cm on the 45 cm tall bag). The bag narrows
    // upwards, so the top edge sits where the body is still as wide as the area.
    printArea: { width: 168, height: 222, centerX: 241, centerY: 401 },
    printAreaCm: { width: 25, height: 33 },
    hasSides: false, // Malfini has no back photo; printed on the front only
  },
  "tote-bags": {
    // Body spans photo x 104–294, y 195–425 (~5 px/cm); ~5 cm margin on every side.
    printArea: { width: 178, height: 208, centerX: 249, centerY: 399 },
    printAreaCm: { width: 30, height: 35 },
    // Both faces are identical, so the back side reuses the front photo
    // (DesignerLayout falls back to the front image when there is no back one).
    hasSides: true,
  },
};

// Storefront tab label and fixed tab order for each configured category.
export const MALFINI_CATEGORY_LABELS: Record<string, string> = {
  "t-shirts": "Pólók",
  sweatshirts: "Pulóverek",
  "polo-shirts": "Galléros pólók",
  "gym-bags": "Tornazsákok",
  "tote-bags": "Vászontáskák",
};
export const MALFINI_CATEGORY_ORDER = [
  "t-shirts",
  "sweatshirts",
  "polo-shirts",
  "gym-bags",
  "tote-bags",
];

type CategorizedProduct = { code: string; categoryCode: string };

/** The storefront category key of a Malfini product (a CATEGORY_CONFIG key when sold). */
export function malfiniCategoryKey(p: CategorizedProduct): string {
  return BAG_CATEGORY_BY_CODE[p.code] ?? p.categoryCode;
}

/** Hungarian category name of a Malfini product, e.g. "Pólók" or "Vászontáskák". */
export function malfiniCategoryLabel(
  p: CategorizedProduct & { categoryName: string }
): string {
  return MALFINI_CATEGORY_LABELS[malfiniCategoryKey(p)] ?? p.categoryName;
}

// Returns the designer config for a Malfini product, or null if it is not sold.
export function getProductDesignConfig(
  p: CategorizedProduct
): CategoryConfig | null {
  return CATEGORY_CONFIG[malfiniCategoryKey(p)] ?? null;
}
