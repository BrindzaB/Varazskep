import { prisma } from "@/lib/db";

// The Malfini products offered without browsing the whole catalogue — the designer's
// product picker and the order form (megrendelő lap) both read this list, so the admin
// changes them in one place.

/** Featured Malfini product codes, in display order. */
export async function getFeaturedMalfiniCodes(): Promise<string[]> {
  const rows = await prisma.featuredMalfiniProduct.findMany({
    orderBy: { position: "asc" },
  });
  return rows.map((r) => r.productCode);
}

/**
 * Replaces the featured list. The caller validates the codes against the catalogue;
 * this only persists them, atomically, in the given order.
 */
export async function setFeaturedMalfiniCodes(codes: string[]): Promise<void> {
  await prisma.$transaction([
    prisma.featuredMalfiniProduct.deleteMany(),
    prisma.featuredMalfiniProduct.createMany({
      data: codes.map((productCode, position) => ({ productCode, position })),
    }),
  ]);
}
