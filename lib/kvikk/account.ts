// Cached access to GET /account-details + derived accessors (active couriers, sender id).
// Server-side only. account-details is small and changes rarely (pricing is monthly), so a
// two-level cache (module L1 + Redis L2, 1h TTL) keeps checkout fast and Kvikk calls rare.
// Mirrors the caching pattern in lib/malfini/client.ts.

import { getAccountDetails } from "./client";
import { getRedisClient } from "@/lib/redis";
import type { AccountDetailsData, KvikkCourier } from "./types";

const REDIS_KEY_ACCOUNT = "kvikk:account-details";
const TTL_SECONDS = 60 * 60; // 1 hour

let cache: { data: AccountDetailsData; expiresAt: number } | null = null;

// Returns the account details, served from cache when fresh. Throws (via getAccountDetails)
// if the API call fails and nothing is cached — callers must handle it, never guess prices.
export async function getCachedAccountDetails(): Promise<AccountDetailsData> {
  const now = Date.now();

  // L1: module-level (per instance)
  if (cache && cache.expiresAt > now) return cache.data;

  // L2: Redis (shared across instances)
  const redis = getRedisClient();
  if (redis) {
    try {
      const cached = await redis.get<AccountDetailsData>(REDIS_KEY_ACCOUNT);
      if (cached) {
        cache = { data: cached, expiresAt: now + TTL_SECONDS * 1000 };
        return cached;
      }
    } catch (err) {
      console.error("[Kvikk] Redis read failed for account-details:", err);
    }
  }

  // L3: Kvikk API
  const data = await getAccountDetails();
  cache = { data, expiresAt: now + TTL_SECONDS * 1000 };
  if (redis) {
    try {
      await redis.set(REDIS_KEY_ACCOUNT, data, { ex: TTL_SECONDS });
    } catch (err) {
      console.error("[Kvikk] Redis write failed for account-details:", err);
    }
  }
  return data;
}

// Slugs of couriers that are active in the account (only these may create shipments).
export async function getActiveCourierSlugs(): Promise<KvikkCourier[]> {
  const { couriers } = await getCachedAccountDetails();
  return couriers.filter((c) => c.status === "active").map((c) => c.slug);
}

// The account's sender id, used as `senderID` on POST /shipment.
// Throws if the account has no configured sender.
export async function getSenderId(): Promise<string> {
  const { senders } = await getCachedAccountDetails();
  const sender = senders[0];
  if (!sender) {
    throw new Error(
      "Kvikk account has no configured sender (senders[] is empty)."
    );
  }
  return sender._id;
}
