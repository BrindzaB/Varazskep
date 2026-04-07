// Malfini REST API v4 client.
// All functions are safe to call from server components and API routes.
// Products are cached via Next.js unstable_cache (Vercel Data Cache) for 1 hour —
// survives cold starts and is shared across all function instances.
// A warmup cron job (/api/warmup) runs every 45 min to keep the cache permanently warm.
// Availability/prices use Next.js ISR (revalidate 5 min) — small responses, cacheable.
// On any error, functions return safe empty fallbacks and log server-side.

import { unstable_cache } from "next/cache";
import { clearCachedToken, getMalfiniToken } from "./auth";
import type {
  MalfiniAvailability,
  MalfiniProduct,
  MalfiniRecommendedPrice,
} from "./types";

const BASE = () => process.env.MALFINI_API_URL ?? "https://api.malfini.com";

// Typed fetch with Bearer token injection and automatic 401 retry.
// Uses Next.js ISR revalidation for small, cacheable responses.
async function malfiniGet<T>(path: string, revalidate: number, attempt = 0): Promise<T> {
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

// Cached fetch of the full product catalog.
// unstable_cache stores the return value in the Vercel Data Cache — shared across
// all function instances and persistent across cold starts (unlike module-level vars).
// TTL: 1 hour. Tag: "malfini-products" (allows manual invalidation if needed).
const _fetchProducts = unstable_cache(
  async (language: string): Promise<MalfiniProduct[]> => {
    const token = await getMalfiniToken();
    const res = await fetch(
      `${BASE()}/api/v4/product?language=${language}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );

    if (res.status === 401) {
      // Token expired server-side — clear, get a fresh one, retry once directly.
      // Not recursive to avoid interacting with the unstable_cache layer.
      clearCachedToken();
      const freshToken = await getMalfiniToken();
      const retry = await fetch(
        `${BASE()}/api/v4/product?language=${language}`,
        { headers: { Authorization: `Bearer ${freshToken}` }, cache: "no-store" },
      );
      if (!retry.ok) {
        throw new Error(`Malfini getProducts failed after 401 retry: ${retry.status}`);
      }
      const retryData: unknown = await retry.json();
      return Array.isArray(retryData) ? (retryData as MalfiniProduct[]) : [];
    }

    if (!res.ok) {
      throw new Error(`Malfini API error ${res.status} for /api/v4/product`);
    }

    const data: unknown = await res.json();
    return Array.isArray(data) ? (data as MalfiniProduct[]) : [];
  },
  ["malfini-products"],
  { revalidate: 3600, tags: ["malfini-products"] },
);

// Returns all active Malfini products. Served from Data Cache on cache hit (< 500ms).
// On cache miss (first deploy or after 1-hour TTL), fetches from Malfini API (~10s).
export async function getProducts(language = "hu"): Promise<MalfiniProduct[]> {
  try {
    return await _fetchProducts(language);
  } catch (err) {
    console.error("[Malfini] getProducts failed:", err);
    return [];
  }
}

// Returns a single product by its 3-char code.
// Fetches the full list (from Data Cache) and filters — no per-product endpoint.
export async function getProduct(
  code: string,
  language = "hu",
): Promise<MalfiniProduct | null> {
  try {
    const products = await getProducts(language);
    return products.find((p) => p.code === code) ?? null;
  } catch (err) {
    console.error(`[Malfini] getProduct(${code}) failed:`, err);
    return null;
  }
}

// Returns real-time stock availability for the given 3-char product codes (e.g. "M150").
// The API `productCodes` param filters by product code, not nomenclature code.
// Response items use `productSizeCode` (7-char) as the SKU key.
// includeFuture=true includes incoming warehouse shipments. Revalidated every 5 minutes.
export async function getAvailabilities(
  productCodes: string[],
): Promise<MalfiniAvailability[]> {
  if (productCodes.length === 0) return [];
  try {
    const query = productCodes.join(",");
    const data = await malfiniGet<MalfiniAvailability[]>(
      `/api/v4/product/availabilities?productCodes=${encodeURIComponent(query)}&includeFuture=true`,
      300,
    );
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("[Malfini] getAvailabilities failed:", err);
    return [];
  }
}

// Returns Malfini's recommended retail prices for the given 3-char product codes.
// The API `productCodes` param filters by product code, not nomenclature code.
// Response items use `productSizeCode` (7-char) as the SKU key.
// Revalidated every 5 minutes via ISR.
export async function getRecommendedPrices(
  productCodes: string[],
): Promise<MalfiniRecommendedPrice[]> {
  if (productCodes.length === 0) return [];
  try {
    const query = productCodes.join(",");
    const data = await malfiniGet<MalfiniRecommendedPrice[]>(
      `/api/v4/product/recommended-prices?productCodes=${encodeURIComponent(query)}`,
      300,
    );
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("[Malfini] getRecommendedPrices failed:", err);
    return [];
  }
}

// Builds a Record<productSizeCode, retailPriceHuf> from Malfini recommended prices.
// Currency-aware: skips EUR→HUF conversion when the API already returns HUF prices.
// Rounds to nearest 10 HUF.
export function buildPriceMap(
  prices: MalfiniRecommendedPrice[],
  convertEurToHuf: (eur: number) => number,
): Record<string, number> {
  return Object.fromEntries(
    prices.map((p) => {
      const huf = p.currency === "HUF" ? p.price : convertEurToHuf(p.price);
      return [p.productSizeCode, Math.round(huf / 10) * 10];
    }),
  );
}

// Convenience: build a Record<productSizeCode, quantity> map.
// Sums all availability records per SKU (multiple dates may exist for inbound stock).
export function buildAvailabilityMap(
  availabilities: MalfiniAvailability[],
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const a of availabilities) {
    map[a.productSizeCode] = (map[a.productSizeCode] ?? 0) + a.quantity;
  }
  return map;
}
