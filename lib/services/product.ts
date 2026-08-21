import { prisma } from "@/lib/db";

// Re-export formatting utils so callers that only need server-side data
// can import everything from one place.
export { formatHuf, getMinPrice } from "@/lib/utils/format";

export type ProductWithVariants = Awaited<
  ReturnType<typeof getActiveProducts>
>[number];

export async function getActiveProducts() {
  return prisma.product.findMany({
    where: { active: true },
    include: {
      variants: {
        orderBy: { price: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getProductBySlug(slug: string) {
  return prisma.product.findUnique({
    where: { slug, active: true },
    include: {
      variants: {
        orderBy: [{ color: "asc" }, { price: "asc" }],
      },
    },
  });
}

export async function getAllProductsAdmin() {
  return prisma.product.findMany({
    include: {
      variants: { orderBy: { price: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getProductByIdAdmin(id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: { variants: { orderBy: { price: "asc" } } },
  });
}

export interface ProductInput {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  mockupType: string | null;
  active: boolean;
}

export async function createProduct(input: ProductInput) {
  return prisma.product.create({ data: input, select: { id: true } });
}

export async function updateProduct(id: string, input: ProductInput) {
  return prisma.product.update({ where: { id }, data: input });
}

export async function toggleProductActive(id: string, active: boolean) {
  return prisma.product.update({ where: { id }, data: { active } });
}

/**
 * Permanently deletes a product and its variants.
 *
 * Existing orders that reference the product's variants are detached
 * (`variantId` → null) rather than deleted, so order history is preserved.
 * This is safe because orders keep denormalized product/color/size fields for
 * the mandatory 8-year retention (see the Order model in schema.prisma).
 * Runs in a transaction so a partial delete can never leave orphaned variants.
 */
export async function deleteProduct(id: string) {
  return prisma.$transaction(async (tx) => {
    const variants = await tx.variant.findMany({
      where: { productId: id },
      select: { id: true },
    });
    const variantIds = variants.map((v) => v.id);

    if (variantIds.length > 0) {
      await tx.order.updateMany({
        where: { variantId: { in: variantIds } },
        data: { variantId: null },
      });
      await tx.variant.deleteMany({ where: { productId: id } });
    }

    await tx.product.delete({ where: { id } });
  });
}

// ── Variants ─────────────────────────────────────────────────────────────────

export interface VariantInput {
  color: string;
  size: string;
  price: number; // HUF, integer
  stock: number; // integer >= 0
  weightGrams: number | null; // gross package weight; null → 500 g shipping fallback
}

// Thrown by createVariant/updateVariant when another variant of the same product
// already uses the given color+size combination. Callers map this to HTTP 409.
export const VARIANT_CONFLICT = "VARIANT_CONFLICT";

/**
 * Validates a raw request body into a VariantInput. Returns a user-facing
 * (Hungarian) error message on failure. Shared by the create + update routes.
 */
export function validateVariantInput(
  raw: unknown,
): { ok: true; value: VariantInput } | { ok: false; error: string } {
  const b = (raw ?? {}) as Record<string, unknown>;

  const color = typeof b.color === "string" ? b.color.trim() : "";
  const size = typeof b.size === "string" ? b.size.trim() : "";
  if (!color) return { ok: false, error: "A szín megadása kötelező." };
  if (!size) return { ok: false, error: "A méret megadása kötelező." };

  const price = Number(b.price);
  if (!Number.isInteger(price) || price <= 0) {
    return { ok: false, error: "Az ár pozitív egész szám legyen (Ft)." };
  }

  const stockRaw = b.stock;
  const stock =
    stockRaw === undefined || stockRaw === null || stockRaw === ""
      ? 0
      : Number(stockRaw);
  if (!Number.isInteger(stock) || stock < 0) {
    return { ok: false, error: "A készlet nem lehet negatív, egész szám legyen." };
  }

  let weightGrams: number | null = null;
  if (b.weightGrams !== undefined && b.weightGrams !== null && b.weightGrams !== "") {
    const w = Number(b.weightGrams);
    if (!Number.isInteger(w) || w <= 0) {
      return { ok: false, error: "A súly pozitív egész szám legyen (gramm)." };
    }
    weightGrams = w;
  }

  return { ok: true, value: { color, size, price, stock, weightGrams } };
}

export async function getVariantById(variantId: string) {
  return prisma.variant.findUnique({ where: { id: variantId } });
}

// True if another variant of the product already uses this color+size.
async function variantComboExists(
  productId: string,
  color: string,
  size: string,
  excludeVariantId?: string,
) {
  const existing = await prisma.variant.findFirst({
    where: {
      productId,
      color,
      size,
      ...(excludeVariantId ? { id: { not: excludeVariantId } } : {}),
    },
    select: { id: true },
  });
  return existing !== null;
}

export async function createVariant(productId: string, input: VariantInput) {
  if (await variantComboExists(productId, input.color, input.size)) {
    throw new Error(VARIANT_CONFLICT);
  }
  return prisma.variant.create({ data: { productId, ...input } });
}

export async function updateVariant(
  variantId: string,
  productId: string,
  input: VariantInput,
) {
  if (await variantComboExists(productId, input.color, input.size, variantId)) {
    throw new Error(VARIANT_CONFLICT);
  }
  return prisma.variant.update({ where: { id: variantId }, data: input });
}

/**
 * Deletes a single variant. Orders referencing it are detached
 * (`variantId` → null) rather than deleted, preserving order history
 * (orders keep denormalized product fields — see deleteProduct / the Order model).
 */
export async function deleteVariant(variantId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.order.updateMany({
      where: { variantId },
      data: { variantId: null },
    });
    await tx.variant.delete({ where: { id: variantId } });
  });
}

export async function getAllProductSlugs() {
  const products = await prisma.product.findMany({
    where: { active: true },
    select: { slug: true },
  });
  return products.map((p) => ({ slug: p.slug }));
}
