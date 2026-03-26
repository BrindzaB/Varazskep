import { prisma } from "@/lib/db";

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

// Returns the lowest variant price for display on the product card.
export function getMinPrice(variants: { price: number }[]): number {
  if (variants.length === 0) return 0;
  return Math.min(...variants.map((v) => v.price));
}

// Formats a HUF integer for display: 4990 → "4 990 Ft"
export function formatHuf(amount: number): string {
  return (
    new Intl.NumberFormat("hu-HU", {
      maximumFractionDigits: 0,
    }).format(amount) + " Ft"
  );
}
