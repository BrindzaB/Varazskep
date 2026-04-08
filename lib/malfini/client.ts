// Malfini REST API v4 client.
// All functions are safe to call from server components and API routes.
// Products are cached in memory for 1 hour (module-level cache bypasses Next.js ISR
// which cannot handle the ~10MB catalog response due to a 2MB size limit).
// A warmup cron job (/api/warmup) runs once daily (05:00 UTC) to pre-populate
// the cache before business hours, reducing cold-start latency.
// Availability/prices use Next.js ISR (revalidate 5 min) — small responses, cacheable.
// On any error, functions return safe empty fallbacks and log server-side.

import { clearCachedToken, getMalfiniToken } from "./auth";
import { getRedisClient, REDIS_KEY_CATALOG, REDIS_CATALOG_TTL_SECONDS } from "@/lib/redis";
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

// Module-level cache for the full product catalog.
// The catalog response is ~10MB — too large for Next.js ISR cache (2MB limit).
// This in-process cache serves subsequent requests instantly in both dev and production.
// TTL: 1 hour. Resets on cold start — the daily warmup cron mitigates this.
let productsCache: {
  data: MalfiniProduct[];
  language: string;
  expiresAt: number;
} | null = null;

// Returns all active Malfini products.
// Uses module-level caching (1 hour TTL) instead of Next.js ISR because the
// response is ~10MB and exceeds Next.js's 2MB data cache limit.
export async function getProducts(language = "hu"): Promise<MalfiniProduct[]> {
  const now = Date.now();

  // L1: module-level in-process cache (0ms latency, per-instance)
  if (
    productsCache &&
    productsCache.language === language &&
    productsCache.expiresAt > now
  ) {
    return productsCache.data;
  }

  // L2: Upstash Redis (shared across all instances, ~5-50ms latency)
  const redis = getRedisClient();
  if (redis) {
    try {
      const cached = await redis.get<MalfiniProduct[]>(REDIS_KEY_CATALOG);
      if (cached) {
        // Populate L1 from Redis so subsequent requests in this instance are instant
        productsCache = { data: cached, language, expiresAt: now + 3600 * 1000 };
        return cached;
      }
    } catch (err) {
      console.error("[Malfini] Redis read failed, falling back to API:", err);
    }
  }

  // L3: Malfini API (~25s — only reached on first deploy or after Redis flush)
  return fetchAndCacheProducts(language);
}

// Fetches fresh catalog from Malfini and writes to both L1 and L2.
// Called by getProducts() on a cache miss, and directly by the warmup cron
// to unconditionally refresh both caches.
async function fetchAndCacheProducts(language = "hu"): Promise<MalfiniProduct[]> {
  const now = Date.now();

  try {
    const token = await getMalfiniToken();
    const res = await fetch(
      `${BASE()}/api/v4/product?language=${language}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      },
    );

    if (res.status === 401) {
      clearCachedToken();
      return fetchAndCacheProducts(language);
    }

    if (!res.ok) {
      throw new Error(`Malfini API error ${res.status} for /api/v4/product`);
    }

    const data: unknown = await res.json();
    const result = Array.isArray(data) ? (data as MalfiniProduct[]) : [];

    // Populate L1
    productsCache = { data: result, language, expiresAt: now + 3600 * 1000 };

    // Populate L2 (Redis) — errors are caught so a Redis failure never breaks the response
    const redis = getRedisClient();
    if (redis) {
      try {
        await redis.set(REDIS_KEY_CATALOG, result, { ex: REDIS_CATALOG_TTL_SECONDS });
      } catch (err) {
        console.error("[Malfini] Redis write failed:", err);
      }
    }

    return result;
  } catch (err) {
    console.error("[Malfini] fetchAndCacheProducts failed:", err);
    return productsCache?.data ?? [];
  }
}

// Unconditionally fetches fresh data from Malfini and writes to both caches.
// Used by the warmup cron to ensure Redis is always refreshed, bypassing any
// existing cache state in the calling function's instance.
export async function warmupMalfiniCache(language = "hu"): Promise<void> {
  await fetchAndCacheProducts(language);
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
