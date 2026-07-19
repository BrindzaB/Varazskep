// Parcel weight helpers for Kvikk shipments.
// Kvikk's POST /shipment requires a per-parcel weight in GRAMS. Product weights come from
// two sources: Malfini (per-size gross weight in kg) and local products (a stored gram
// value, added to Variant in step 8.3). These pure helpers convert + pick a value with a
// safe fallback; the item-level resolver that fetches those inputs lives in the service
// layer (lib/services/shipping.ts, step 8.3).

// Fallback used when no product weight is available from any source. Deliberately
// conservative — a slightly-too-high weight is safer than a missing/too-low one, which
// could trip a courier's wrong_weight_value error.
export const DEFAULT_PARCEL_WEIGHT_GRAMS = 500;

// Converts kilograms to grams, rounded to the nearest gram. Malfini exposes weights in kg.
export function kgToGrams(kg: number): number {
  return Math.round(kg * 1000);
}

// Resolves a parcel weight in grams from the available sources, in priority order:
//   1. an explicitly stored gram value (local products),
//   2. a Malfini gross weight in kg (converted to grams),
//   3. DEFAULT_PARCEL_WEIGHT_GRAMS.
// Non-positive or missing values are skipped so a bad 0/negative never wins.
export function resolveWeightGrams(input: {
  storedGrams?: number | null;
  grossWeightKg?: number | null;
}): number {
  if (input.storedGrams != null && input.storedGrams > 0) {
    return input.storedGrams;
  }
  if (input.grossWeightKg != null && input.grossWeightKg > 0) {
    return kgToGrams(input.grossWeightKg);
  }
  return DEFAULT_PARCEL_WEIGHT_GRAMS;
}
