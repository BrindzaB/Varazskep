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

export async function getAllProductSlugs() {
  const products = await prisma.product.findMany({
    where: { active: true },
    select: { slug: true },
  });
  return products.map((p) => ({ slug: p.slug }));
}
