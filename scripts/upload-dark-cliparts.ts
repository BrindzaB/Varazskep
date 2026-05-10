/**
 * Dark clipart variant uploader
 *
 * Usage:
 *   npx tsx scripts/upload-dark-cliparts.ts /path/to/dark-clipart-root
 *
 * Expected directory structure (same as the light cliparts):
 *   dark-clipart-root/
 *     Halloween/
 *       Witch Please_sîtÇt.svg
 *     Állatos/
 *       Bee Happy_sîtÇt.svg
 *
 * For each dark SVG, strips the "_sîtÇt" suffix from the filename stem
 * to derive the base name, then finds the matching light Clipart record
 * (by name + category) and updates its darkSvgUrl.
 *
 * Safe to re-run — records with darkSvgUrl already set are skipped.
 */

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

// ── Env / config ─────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET_CLIPART ?? "clipart";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "ERROR: Missing env vars NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Make sure your .env.local is present and readable."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: Missing env var DATABASE_URL.");
  process.exit(1);
}
const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ── Helpers ───────────────────────────────────────────────────────────────────

const DARK_SUFFIX = "_sîtÇt"; // "_sîtÇt" — filesystem encoding of "sötét"

/** Strips the dark suffix and converts separators to spaces, matching stemToName in upload-cliparts.ts */
function darkStemToBaseName(filename: string): string {
  const stem = path.basename(filename, path.extname(filename));
  // Remove the dark suffix before replacing separators
  const withoutSuffix = stem.endsWith(DARK_SUFFIX)
    ? stem.slice(0, -DARK_SUFFIX.length)
    : stem;
  return withoutSuffix.replace(/[-_]+/g, " ").trim();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const rootDir = process.argv[2];
  if (!rootDir) {
    console.error("Usage: npx tsx scripts/upload-dark-cliparts.ts <path-to-dark-clipart-folder>");
    process.exit(1);
  }

  const absRoot = path.resolve(rootDir);
  if (!fs.existsSync(absRoot) || !fs.statSync(absRoot).isDirectory()) {
    console.error(`ERROR: "${absRoot}" is not a directory.`);
    process.exit(1);
  }

  const categoryDirs = fs
    .readdirSync(absRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  if (categoryDirs.length === 0) {
    console.error("ERROR: No subfolders found. Each subfolder should be a category.");
    process.exit(1);
  }

  // Collect all dark SVG entries
  const entries: { category: string; svgPath: string; baseName: string }[] = [];

  for (const dir of categoryDirs) {
    const category = dir.name;
    const dirPath = path.join(absRoot, category);
    const files = fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter((f) => f.isFile() && f.name.toLowerCase().endsWith(".svg"));

    for (const file of files) {
      entries.push({
        category,
        svgPath: path.join(dirPath, file.name),
        baseName: darkStemToBaseName(file.name),
      });
    }
  }

  if (entries.length === 0) {
    console.error("ERROR: No SVG files found. Convert .cdr files first.");
    process.exit(1);
  }

  console.log(`Found ${entries.length} dark SVG(s) across ${categoryDirs.length} category folder(s).\n`);

  // Load all existing clipart records for matching
  const allCliparts = await prisma.clipart.findMany({
    select: { id: true, name: true, category: true, darkSvgUrl: true },
  });

  // Index by "category__name" for fast lookup
  const clipartIndex = new Map(
    allCliparts.map((c) => [`${c.category}__${c.name}`, c])
  );

  let updated = 0;
  let skipped = 0;
  let unmatched = 0;
  let failed = 0;

  for (let i = 0; i < entries.length; i++) {
    const { category, svgPath, baseName } = entries[i];
    const label = `[${i + 1}/${entries.length}] "${path.basename(svgPath)}" → ${category} / "${baseName}"`;

    const existing = clipartIndex.get(`${category}__${baseName}`);

    if (!existing) {
      console.warn(`  UNMATCHED  ${label}`);
      unmatched++;
      continue;
    }

    if (existing.darkSvgUrl) {
      console.log(`  SKIP  ${label}  (darkSvgUrl already set)`);
      skipped++;
      continue;
    }

    try {
      const buffer = fs.readFileSync(svgPath);
      const filename = `${crypto.randomUUID()}.svg`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filename, buffer, { contentType: "image/svg+xml", upsert: false });

      if (uploadError) throw new Error(uploadError.message);

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filename);

      await prisma.clipart.update({
        where: { id: existing.id },
        data: { darkSvgUrl: urlData.publicUrl },
      });

      console.log(`  OK    ${label}`);
      updated++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  FAIL  ${label}  — ${msg}`);
      failed++;
    }
  }

  console.log(
    `\nDone. Updated: ${updated}  |  Skipped (already set): ${skipped}  |  Unmatched: ${unmatched}  |  Failed: ${failed}`
  );

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main();
