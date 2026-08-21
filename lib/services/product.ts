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

export async function getAllProductSlugs() {
  const products = await prisma.product.findMany({
    where: { active: true },
    select: { slug: true },
  });
  return products.map((p) => ({ slug: p.slug }));
}
