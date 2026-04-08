import { Redis } from "@upstash/redis";

// Lazy singleton — returns null when env vars are not set so callers can
// gracefully fall back to the Malfini API instead of crashing.
let _redis: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (_redis) return _redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    // Redis is optional — without env vars the app falls back to direct Malfini fetches.
    console.warn(
      "[Redis] UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set — Redis cache disabled.",
    );
    return null;
  }

  _redis = new Redis({ url, token });
  return _redis;
}

// Redis key for the Malfini product catalog (Hungarian language).
export const REDIS_KEY_CATALOG = "malfini:catalog:hu";

// 25 hours — ensures the daily warmup cron (05:00 UTC) always refreshes Redis
// before it expires, with a 1-hour safety overlap.
export const REDIS_CATALOG_TTL_SECONDS = 25 * 60 * 60;
