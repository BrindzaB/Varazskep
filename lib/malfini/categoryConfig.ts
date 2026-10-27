// Maps Malfini products to storefront categories and designer configuration.
// A product without a designer config is not sold: it is hidden from the Termékek page,
// the designer, the admin pickers and the sitemap.
//
// Clothing is configured per Malfini categoryCode. Malfini lumps every bag into a single
// "bags" category, so bags are picked one by one (BAG_CATEGORY_BY_CODE): only the listed
// products are sold, each under its own storefront category. A bag Malfini adds later
// stays hidden until it is listed here — its photo needs its own print area anyway.
//
// Templates are described on the Malfini product photo (lib/designer/templates.ts). One
// template serves a whole category, measured on a reference product in size M — the
// photos show a single size, so the on-screen proportion is exact for that size only.
// Garment photos are 3D (ghost mannequin): the cloth wraps the body, so the visible width
// is less than the size chart's flat width. The scale is therefore taken from the length
// (shoulder to hem, size chart "A"), which the front view shows undistorted.

import type { PrintTemplate } from "@/lib/designer/templates";

// Every Malfini product photo (`~w400` image links) is 400×453.
const MALFINI_PHOTO_SIZE = { width: 400, height: 453 };

// Storefront category for each bag we sell, keyed by 3-char Malfini product code.
const BAG_CATEGORY_BY_CODE: Record<string, string> = {
  "912": "gym-bags", // Energy — polyester drawstring bag, 34×45 cm
  "921": "tote-bags", // Shopper — cotton tote, 40×45 cm
};

export const CATEGORY_CONFIG: Record<string, PrintTemplate> = {
  "t-shirts": {
    // Reference 129 Basic, size M: 72 cm long = 380 px on the photo.
    mockupSize: MALFINI_PHOTO_SIZE,
    mockupPxPerCm: 5.28,
    printAreaCm: { width: 35, height: 48 },
    printCenterPx: { x: 200, y: 226.5 },
    hasSides: true,
  },
  "sweatshirts": {
    // Reference P41 Zero, size M: 72 cm long = 391 px on the photo. Hoodies (e.g. 840
    // Break) photograph smaller because of the hood, so this is approximate for them.
    mockupSize: MALFINI_PHOTO_SIZE,
    mockupPxPerCm: 5.43,
    printAreaCm: { width: 34, height: 46.5 },
    printCenterPx: { x: 201.7, y: 226.5 },
    hasSides: true,
  },
  "polo-shirts": {
    // Reference P21 Joy, size M: 73 cm long = 387 px on the photo. Narrower and lower
    // than the t-shirt area because of the collar and the button placket.
    mockupSize: MALFINI_PHOTO_SIZE,
    mockupPxPerCm: 5.3,
    printAreaCm: { width: 32, height: 47.5 },
    printCenterPx: { x: 200, y: 234.9 },
    hasSides: true,
  },
  "gym-bags": {
    // 912 Energy, 34×45 cm. The drawstring gathers the top third, so the area sits on the
    // flat lower body; its top edge is where the narrowing bag is still as wide as the area.
    mockupSize: MALFINI_PHOTO_SIZE,
    mockupPxPerCm: 5.666,
    printAreaCm: { width: 25, height: 33 },
    printCenterPx: { x: 192.4, y: 311.6 },
    hasSides: false, // Malfini has no back photo; printed on the front only
  },
  "tote-bags": {
    // 921 Shopper, 40×45 cm; ~5 cm margin on every side.
    mockupSize: MALFINI_PHOTO_SIZE,
    mockupPxPerCm: 5.005,
    printAreaCm: { width: 30, height: 35 },
    printCenterPx: { x: 199.2, y: 309.9 },
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
): PrintTemplate | null {
  return CATEGORY_CONFIG[malfiniCategoryKey(p)] ?? null;
}
