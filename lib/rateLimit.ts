import type { NextRequest } from "next/server";
import { getRedisClient } from "@/lib/redis";

/**
 * Fixed-window rate limit backed by Redis: true once `key` has been hit more than
 * `limit` times within `windowSeconds`. Without Redis (local dev) nothing is limited.
 */
export async function isRateLimited(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;
  const count = await redis.incr(`ratelimit:${key}`);
  if (count === 1) await redis.expire(`ratelimit:${key}`, windowSeconds);
  return count > limit;
}

/** The client IP as reported by the Vercel edge (first x-forwarded-for hop). */
export function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.ip ||
    "unknown"
  );
}
