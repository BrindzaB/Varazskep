// Encodes the ordered cart lines into Stripe session metadata and decodes them in the
// webhook. Shared by both routes so the two sides cannot drift apart.
//
// Stripe caps metadata at 50 keys and 500 characters per value. The cart used to travel
// as one `cartItems` JSON value, which overflowed after two or three lines. Each line now
// gets its own `item_<n>` key, with `itemCount` saying how many there are.

export interface CartItemMeta {
  source: "local" | "malfini";
  // Local only:
  variantId?: string;
  // Malfini only:
  productSizeCode?: string;
  productCode?: string;
  // Always set — denormalized for 8-year retention:
  productName: string;
  colorName: string;
  sizeName: string;
  quantity: number;
  unitPriceHuf: number; // gross, as charged
  printFeeHuf: number; // gross per piece, as charged (0 = no design)
  designId?: string;
}

const STRIPE_METADATA_VALUE_MAX = 500;

// Keys the checkout route spends on customer + shipping data (13 today). The remaining
// budget of Stripe's 50 keys goes to cart lines; 30 leaves headroom for new fields.
export const MAX_CART_LINES = 30;

/**
 * Returns the `itemCount` + `item_<n>` metadata entries for the given lines, or null if
 * a line does not fit Stripe's per-value limit (the caller rejects the checkout).
 */
export function encodeCartItems(
  items: CartItemMeta[]
): Record<string, string> | null {
  const entries: Record<string, string> = { itemCount: String(items.length) };
  for (let i = 0; i < items.length; i++) {
    const value = JSON.stringify(items[i]);
    if (value.length > STRIPE_METADATA_VALUE_MAX) return null;
    entries[`item_${i}`] = value;
  }
  return entries;
}

/**
 * Reads the cart lines back from session metadata. Returns [] when any line is missing
 * or malformed — an order must never be created with part of what was paid for.
 */
export function decodeCartItems(
  metadata: Record<string, string>
): CartItemMeta[] {
  const count = parseInt(metadata.itemCount ?? "", 10);
  if (!Number.isInteger(count) || count < 1) return [];

  const items: CartItemMeta[] = [];
  for (let i = 0; i < count; i++) {
    const item = parseItem(metadata[`item_${i}`]);
    if (!item) return [];
    items.push(item);
  }
  return items;
}

function parseItem(raw: string | undefined): CartItemMeta | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const i = parsed as Record<string, unknown>;
  if (i.source !== "local" && i.source !== "malfini") return null;
  if (typeof i.productName !== "string") return null;
  if (typeof i.colorName !== "string") return null;
  if (typeof i.sizeName !== "string") return null;
  if (!isPositiveInt(i.quantity)) return null;
  if (!isNonNegativeInt(i.unitPriceHuf)) return null;
  if (!isNonNegativeInt(i.printFeeHuf)) return null;
  if (i.source === "local" && typeof i.variantId !== "string") return null;
  if (i.source === "malfini" && typeof i.productSizeCode !== "string")
    return null;
  if (i.designId !== undefined && typeof i.designId !== "string") return null;
  return parsed as CartItemMeta;
}

function isPositiveInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v > 0;
}

function isNonNegativeInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}
