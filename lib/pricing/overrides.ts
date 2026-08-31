// Manual per-SKU selling prices for Malfini products.
//
// The computed price (cost × árrés × VAT) is right for most of the catalog, but Malfini's
// implied retail markup is not uniform — measured per product it runs from 1.50× cost to
// 3.08×. On the high end a flat árrés prices well under the market, so those SKUs need a
// price set by hand. This table is the top of the resolution chain in ./resolve.ts.
//
// Sparse by design: a SKU with no row falls through to the computed price, so clearing an
// override is a delete rather than a magic value.

import { prisma } from "@/lib/db";

export interface PriceOverrideInput {
  productSizeCode: string;
  productCode: string;
  priceHuf: number;
}

// Same shape the admin table renders.
export interface PriceOverrideRow extends PriceOverrideInput {
  updatedAt: Date;
}

// SKU → manual gross price, for the SKUs asked about. Absent keys have no override.
export async function getPriceOverrideMap(
  productSizeCodes: string[]
): Promise<Record<string, number>> {
  if (productSizeCodes.length === 0) return {};
  const rows = await prisma.priceOverride.findMany({
    where: { productSizeCode: { in: Array.from(new Set(productSizeCodes)) } },
    select: { productSizeCode: true, priceHuf: true },
  });
  return Object.fromEntries(rows.map((r) => [r.productSizeCode, r.priceHuf]));
}

export async function getPriceOverridesForProduct(
  productCode: string
): Promise<PriceOverrideRow[]> {
  return prisma.priceOverride.findMany({
    where: { productCode },
    orderBy: { productSizeCode: "asc" },
  });
}

// Upper bound on a manual price. Generous — it exists to catch a fat-fingered extra
// digit, not to second-guess the admin.
const MAX_PRICE_HUF = 10_000_000;

/**
 * Validates a bulk override payload. Returns a user-facing (Hungarian) error on failure,
 * mirroring validateVariantInput() in lib/services/product.ts.
 */
export function validatePriceOverrides(
  raw: unknown
): { ok: true; value: PriceOverrideInput[] } | { ok: false; error: string } {
  const body = (raw ?? {}) as Record<string, unknown>;
  const list = body.overrides;

  if (!Array.isArray(list) || list.length === 0) {
    return { ok: false, error: "Nincs mentendő ár." };
  }

  const out: PriceOverrideInput[] = [];
  const seen = new Set<string>();

  for (const entry of list) {
    const e = (entry ?? {}) as Record<string, unknown>;
    const productSizeCode =
      typeof e.productSizeCode === "string" ? e.productSizeCode.trim() : "";
    const productCode =
      typeof e.productCode === "string" ? e.productCode.trim() : "";

    if (!productSizeCode || !productCode) {
      return { ok: false, error: "Hiányzó termékazonosító." };
    }
    if (seen.has(productSizeCode)) {
      return {
        ok: false,
        error: `Ugyanaz a méret többször szerepel: ${productSizeCode}.`,
      };
    }
    seen.add(productSizeCode);

    const priceHuf = Number(e.priceHuf);
    if (!Number.isInteger(priceHuf) || priceHuf <= 0) {
      return { ok: false, error: "Az ár pozitív egész szám legyen (Ft)." };
    }
    if (priceHuf > MAX_PRICE_HUF) {
      return { ok: false, error: "Az ár túl nagy — elírás lehet." };
    }

    out.push({ productSizeCode, productCode, priceHuf });
  }

  return { ok: true, value: out };
}

// Validates a list of SKUs to clear.
export function validateSkuList(
  raw: unknown
): { ok: true; value: string[] } | { ok: false; error: string } {
  const body = (raw ?? {}) as Record<string, unknown>;
  const list = body.productSizeCodes;

  if (!Array.isArray(list) || list.length === 0) {
    return { ok: false, error: "Nincs törlendő ár." };
  }
  const out: string[] = [];
  for (const entry of list) {
    if (typeof entry !== "string" || !entry.trim()) {
      return { ok: false, error: "Érvénytelen termékazonosító." };
    }
    out.push(entry.trim());
  }
  return { ok: true, value: Array.from(new Set(out)) };
}

export async function setPriceOverrides(
  overrides: PriceOverrideInput[]
): Promise<void> {
  await prisma.$transaction(
    overrides.map((o) =>
      prisma.priceOverride.upsert({
        where: { productSizeCode: o.productSizeCode },
        create: o,
        update: { productCode: o.productCode, priceHuf: o.priceHuf },
      })
    )
  );
}

// Deleting is how an override is cleared — the SKU then falls back to the computed price.
export async function clearPriceOverrides(
  productSizeCodes: string[]
): Promise<number> {
  const { count } = await prisma.priceOverride.deleteMany({
    where: { productSizeCode: { in: productSizeCodes } },
  });
  return count;
}
