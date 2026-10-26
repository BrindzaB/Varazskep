import { prisma } from "@/lib/db";

// The "Népszerű termékek" box on the Termékek page — an admin-curated, ordered list that
// mixes Malfini and local products. Keys and limits: lib/shop/popular.ts.

/** The subset of the given local product ids that exist. */
export async function findExistingLocalProductIds(
  ids: string[]
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}

/** Popular product keys, in display order. */
export async function getPopularProductKeys(): Promise<string[]> {
  const rows = await prisma.popularProduct.findMany({
    orderBy: { position: "asc" },
  });
  return rows.map((r) => r.key);
}

/**
 * Replaces the popular list. The caller validates the keys against the catalogue; this
 * only persists them, atomically, in the given order. An empty list hides the box.
 */
export async function setPopularProductKeys(keys: string[]): Promise<void> {
  await prisma.$transaction([
    prisma.popularProduct.deleteMany(),
    prisma.popularProduct.createMany({
      data: keys.map((key, position) => ({ key, position })),
    }),
  ]);
}
