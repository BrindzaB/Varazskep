import { prisma } from "@/lib/db";
import {
  isCategoryIconKey,
  type CategoryIconKey,
} from "@/lib/shop/categoryIcons";

/** Admin-assigned pictograms of the local product categories, by category name. */
export async function getCategoryIcons(): Promise<Record<string, CategoryIconKey>> {
  const rows = await prisma.categoryIcon.findMany();
  const out: Record<string, CategoryIconKey> = {};
  for (const row of rows) {
    // A key dropped from the icon set falls back to the default icon on the page.
    if (isCategoryIconKey(row.icon)) out[row.category] = row.icon;
  }
  return out;
}

/** Replaces every category's icon assignment. The caller validates the input. */
export async function setCategoryIcons(
  icons: Record<string, CategoryIconKey>
): Promise<void> {
  await prisma.$transaction([
    prisma.categoryIcon.deleteMany(),
    prisma.categoryIcon.createMany({
      data: Object.entries(icons).map(([category, icon]) => ({ category, icon })),
    }),
  ]);
}
