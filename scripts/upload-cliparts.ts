/**
 * Batch clipart uploader
 *
 * Usage:
 *   npx tsx scripts/upload-cliparts.ts /path/to/clipart-root
 *
 * Directory structure expected:
 *   clipart-root/
 *     Állatok/       ← becomes category name
 *       kutya.svg
 *       macska.svg
 *     Természet/
 *       fa.svg
 *       virág.svg
 *
 * Each subfolder name → category. SVG files only (convert .cdr first with Inkscape).
 * Already-imported files (matched by name + category) are skipped on re-run.
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

// ── Env / config ────────────────────────────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a filename stem to a human-readable name.
 *  "kutya-ugro" → "kutya ugro"  (hyphens and underscores → spaces)
 */
function stemToName(filename: string): string {
  return path.basename(filename, path.extname(filename))
    .replace(/[-_]+/g, " ")
    .trim();
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const rootDir = process.argv[2];
  if (!rootDir) {
    console.error("Usage: npx tsx scripts/upload-cliparts.ts <path-to-clipart-folder>");
    process.exit(1);
  }

  const absRoot = path.resolve(rootDir);
  if (!fs.existsSync(absRoot) || !fs.statSync(absRoot).isDirectory()) {
    console.error(`ERROR: "${absRoot}" is not a directory.`);
    process.exit(1);
  }

  // Build list of (category, svgPath) pairs from one-level-deep subfolder scan
  const entries: { category: string; svgPath: string; name: string }[] = [];

  const categoryDirs = fs
    .readdirSync(absRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  if (categoryDirs.length === 0) {
    console.error(
      "ERROR: No subfolders found in the root directory.\n" +
        "Each subfolder should represent a category and contain SVG files."
    );
    process.exit(1);
  }

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
        name: stemToName(file.name),
      });
    }
  }

  if (entries.length === 0) {
    console.error("ERROR: No SVG files found in any subfolder. Did you convert the .cdr files first?");
    process.exit(1);
  }

  console.log(`Found ${entries.length} SVG file(s) across ${categoryDirs.length} category folder(s).`);

  // Pre-load existing name+category combos to skip duplicates
  const existing = await prisma.clipart.findMany({ select: { name: true, category: true } });
  const existingSet = new Set(existing.map((c) => `${c.category}__${c.name}`));

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < entries.length; i++) {
    const { category, svgPath, name } = entries[i];
    const label = `[${i + 1}/${entries.length}] "${path.basename(svgPath)}" → ${category}`;

    const key = `${category}__${name}`;
    if (existingSet.has(key)) {
      console.log(`  SKIP  ${label}  (already imported)`);
      skipped++;
      continue;
    }

    try {
      const buffer = fs.readFileSync(svgPath);
      const filename = `${crypto.randomUUID()}.svg`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filename, buffer, { contentType: "image/svg+xml", upsert: false });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filename);

      await prisma.clipart.create({
        data: { name, category, svgUrl: urlData.publicUrl },
      });

      console.log(`  OK    ${label}`);
      uploaded++;
      existingSet.add(key); // prevent duplicates within this run
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  FAIL  ${label}  — ${msg}`);
      failed++;
    }
  }

  console.log(
    `\nDone. Uploaded: ${uploaded}  |  Skipped (already existed): ${skipped}  |  Failed: ${failed}`
  );

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main();
