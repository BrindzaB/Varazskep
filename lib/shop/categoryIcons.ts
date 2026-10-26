// Pictograms for the Termékek page category tiles. The keys are stored in CategoryIcon.icon,
// so they must stay stable; the drawings live in components/shop/CategoryIcon.tsx.
// Plain data (no React) so the admin API can validate against it.

export const CATEGORY_ICONS = {
  all: "Összes",
  tshirt: "Póló",
  sweatshirt: "Pulóver",
  polo: "Galléros póló",
  mug: "Bögre",
  pillow: "Párna",
  bag: "Táska",
  gift: "Ajándék",
  image: "Kép / vászon",
  phone: "Telefontok",
  key: "Kulcstartó",
  tag: "Egyéb",
} as const;

export type CategoryIconKey = keyof typeof CATEGORY_ICONS;

export const CATEGORY_ICON_KEYS = Object.keys(CATEGORY_ICONS) as CategoryIconKey[];

// Shown for a local category the admin has not assigned an icon to.
export const DEFAULT_CATEGORY_ICON: CategoryIconKey = "tag";

// Fixed icons for the Malfini categories (lib/malfini categoryCode).
export const MALFINI_CATEGORY_ICONS: Record<string, CategoryIconKey> = {
  "t-shirts": "tshirt",
  sweatshirts: "sweatshirt",
  "polo-shirts": "polo",
};

export function isCategoryIconKey(value: unknown): value is CategoryIconKey {
  return typeof value === "string" && value in CATEGORY_ICONS;
}
