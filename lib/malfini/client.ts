// Malfini REST API v4 client.
// All functions are safe to call from server components and API routes.
// Products are cached for 1 hour; availability/prices for 5 minutes.
// On any error, functions return safe empty fallbacks and log server-side.

import { clearCachedToken, getMalfiniToken } from "./auth";
import type {
  MalfiniAvailability,
  MalfiniProduct,
  MalfiniRecommendedPrice,
} from "./types";

const BASE = () => process.env.MALFINI_API_URL ?? "https://api.malfini.com";

// Typed fetch with Bearer token injection and automatic 401 retry.
async function malfiniGet<T>(
  path: string,
  revalidate: number,
  attempt = 0
): Promise<T> {
  const token = await getMalfiniToken();

  const res = await fetch(`${BASE()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate },
  });

  if (res.status === 401 && attempt === 0) {
    // Token may have expired server-side before our TTL — clear and retry once.
    clearCachedToken();
    return malfiniGet<T>(path, revalidate, 1);
  }

  if (!res.ok) {
    throw new Error(`Malfini API error ${res.status} for ${path}`);
  }

  return res.json() as Promise<T>;
}

// Returns all active Malfini products.
// Revalidated every 1 hour via ISR.
export async function getProducts(language = "hu"): Promise<MalfiniProduct[]> {
  try {
    const data = await malfiniGet<MalfiniProduct[]>(
      `/api/v4/product?language=${language}`,
      3600
    );
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("[Malfini] getProducts failed:", err);
    return [];
  }
}

// Returns a single product by its 3-char code.
// Fetches the full list and filters — no per-product endpoint is documented.
// ISR cache means this is a cheap operation in production.
export async function getProduct(
  code: string,
  language = "hu"
): Promise<MalfiniProduct | null> {
  try {
    const products = await getProducts(language);
    return products.find((p) => p.code === code) ?? null;
  } catch (err) {
    console.error(`[Malfini] getProduct(${code}) failed:`, err);
    return null;
  }
}

// Returns real-time stock availability for the given productSizeCodes (7-char SKUs).
// Revalidated every 5 minutes.
export async function getAvailabilities(
  productSizeCodes: string[]
): Promise<MalfiniAvailability[]> {
  if (productSizeCodes.length === 0) return [];
  try {
    const query = productSizeCodes.join(",");
    const data = await malfiniGet<MalfiniAvailability[]>(
      `/api/v4/product/availabilities?productCodes=${encodeURIComponent(query)}`,
      300
    );
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("[Malfini] getAvailabilities failed:", err);
    return [];
  }
}

// Returns recommended retail prices for the given productSizeCodes.
// Revalidated every 5 minutes.
export async function getRecommendedPrices(
  productSizeCodes: string[]
): Promise<MalfiniRecommendedPrice[]> {
  if (productSizeCodes.length === 0) return [];
  try {
    const query = productSizeCodes.join(",");
    const data = await malfiniGet<MalfiniRecommendedPrice[]>(
      `/api/v4/product/recommended-prices?productCodes=${encodeURIComponent(query)}`,
      300
    );
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("[Malfini] getRecommendedPrices failed:", err);
    return [];
  }
}

// Convenience: build a Record<productSizeCode, priceHuf> map from a product's
// nomenclatures. Returns 0 for any SKU not found in the price list.
export function buildPriceMap(
  prices: MalfiniRecommendedPrice[],
  convertEurToHuf: (eur: number) => number
): Record<string, number> {
  return Object.fromEntries(
    prices.map((p) => [p.productSizeCode, convertEurToHuf(p.price)])
  );
}

// Convenience: build a Record<productSizeCode, quantity> map.
export function buildAvailabilityMap(
  availabilities: MalfiniAvailability[]
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const a of availabilities) {
    map[a.productSizeCode] = (map[a.productSizeCode] ?? 0) + a.quantity;
  }
  return map;
}
