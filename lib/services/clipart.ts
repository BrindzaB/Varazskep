import { prisma } from "@/lib/db";
import type { Clipart } from "@/lib/generated/prisma/client";

export type { Clipart };

export interface ClipartInput {
  name: string;
  category: string;
  svgUrl: string;
}

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

// Admin: returns all clipart (active and inactive), ordered by category then name.
export async function getAllClipartAdmin(): Promise<Clipart[]> {
  return prisma.clipart.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
}

// Admin: returns all distinct category names (active and inactive).
export async function getAllCategoriesAdmin(): Promise<string[]> {
  const rows = await prisma.clipart.findMany({
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });
  return rows.map((row) => row.category);
}

// Admin: creates a new clipart record.
export async function createClipartRecord(data: ClipartInput): Promise<Clipart> {
  return prisma.clipart.create({ data });
}

// Admin: toggles the active flag of a clipart item.
export async function toggleClipartActive(id: string, active: boolean): Promise<Clipart> {
  return prisma.clipart.update({ where: { id }, data: { active } });
}
