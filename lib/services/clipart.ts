import { prisma } from "@/lib/db";
import type { Clipart } from "@/lib/generated/prisma/client";

export type { Clipart };

// Returns all active clipart items, ordered by category then name.
export async function getActiveClipart(): Promise<Clipart[]> {
  return prisma.clipart.findMany({
    where: { active: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
}

// Returns the distinct category names for active clipart, sorted alphabetically.
export async function getClipartCategories(): Promise<string[]> {
  const rows = await prisma.clipart.findMany({
    where: { active: true },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });
  return rows.map((row) => row.category);
}
