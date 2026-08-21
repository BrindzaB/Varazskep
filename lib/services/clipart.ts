import { prisma } from "@/lib/db";
import { createSupabaseAdmin, BUCKET_CLIPART } from "@/lib/supabase";
import type { Clipart } from "@/lib/generated/prisma/client";

export type { Clipart };

export interface ClipartInput {
  name: string;
  category: string;
  svgUrl: string;
  darkSvgUrl?: string | null;
}

// Uploads a single SVG to the clipart bucket and returns its public URL.
// Shared by the clipart create + edit routes (light and dark variants alike).
export async function uploadClipartSvg(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `${crypto.randomUUID()}.svg`;
  const supabase = createSupabaseAdmin();
  const { error } = await supabase.storage
    .from(BUCKET_CLIPART)
    .upload(filename, buffer, { contentType: "image/svg+xml", upsert: false });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(BUCKET_CLIPART).getPublicUrl(filename);
  return data.publicUrl;
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

// Admin: returns a single clipart by id (active or inactive), or null.
export async function getClipartByIdAdmin(id: string): Promise<Clipart | null> {
  return prisma.clipart.findUnique({ where: { id } });
}

// Admin: creates a new clipart record.
export async function createClipartRecord(data: ClipartInput): Promise<Clipart> {
  return prisma.clipart.create({ data });
}

// Fields an admin can change when editing a clipart. Only provided keys are
// updated; darkSvgUrl accepts null to remove the dark variant.
export interface ClipartUpdate {
  name?: string;
  category?: string;
  svgUrl?: string;
  darkSvgUrl?: string | null;
}

// Admin: updates a clipart record (name/category and/or the SVG variants).
export async function updateClipart(id: string, data: ClipartUpdate): Promise<Clipart> {
  return prisma.clipart.update({ where: { id }, data });
}

// Admin: toggles the active flag of a clipart item.
export async function toggleClipartActive(id: string, active: boolean): Promise<Clipart> {
  return prisma.clipart.update({ where: { id }, data: { active } });
}
