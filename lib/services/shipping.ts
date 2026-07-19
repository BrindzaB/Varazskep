// Shipping-related business logic. DB + Malfini access lives here (service layer) so the
// pure weight helpers in lib/kvikk/weight.ts stay side-effect free and unit-testable.

import { prisma } from "@/lib/db";
import { getNomenclatureGrossWeightKg } from "@/lib/malfini/client";
import { resolveWeightGrams } from "@/lib/kvikk/weight";

// Identifies the ordered item, mirroring the two product sources in the cart/order.
export type ParcelWeightInput =
  | { source: "local"; variantId: string }
  | { source: "malfini"; productCode: string; productSizeCode: string };

// Resolves the Kvikk parcel weight (grams) for an ordered item:
//   - local products: the stored Variant.weightGrams,
//   - Malfini products: the per-size gross weight from the cached catalog,
// falling back to DEFAULT_PARCEL_WEIGHT_GRAMS when neither is available.
export async function resolveParcelWeightGrams(
  item: ParcelWeightInput
): Promise<number> {
  if (item.source === "local") {
    const variant = await prisma.variant.findUnique({
      where: { id: item.variantId },
      select: { weightGrams: true },
    });
    return resolveWeightGrams({ storedGrams: variant?.weightGrams ?? null });
  }

  const grossWeightKg = await getNomenclatureGrossWeightKg(
    item.productCode,
    item.productSizeCode
  );
  return resolveWeightGrams({ grossWeightKg });
}
