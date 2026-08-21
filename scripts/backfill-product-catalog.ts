/**
 * One-time, non-destructive backfill for the storefront/designer split.
 *
 * Populates the two new columns for EXISTING local products from the current
 * hardcoded mockup config, so the DB-driven storefront (Phase 2) renders them
 * exactly as before:
 *   - Product.category   ← derived from mockupType (Bögrék / Párnák)
 *   - Variant.imageUrl   ← per-colour photo from MOCKUP_CONFIG.colorImages
 *
 * Only fills fields that are currently NULL — never overwrites values an admin
 * may already have set. Safe to run multiple times.
 *
 * Usage:  npx tsx scripts/backfill-product-catalog.ts
 */

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { MOCKUP_CONFIG } from "../lib/designer/mockupConfig";

// Storefront category label derived from the (code-side) designer template key.
const CATEGORY_BY_MOCKUP: Record<string, string> = {
  mug: "Bögrék",
  basic_mug: "Bögrék",
  mug_with_spoon: "Bögrék",
  pillow: "Párnák",
};

async function main() {
  // Prefer the direct connection for one-off scripts (the transaction pooler
  // can stall on batched writes); fall back to DATABASE_URL.
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DIRECT_URL / DATABASE_URL is not set (check .env.local).");
  }
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  let productsUpdated = 0;
  let variantsUpdated = 0;

  try {
    const products = await prisma.product.findMany({
      include: { variants: true },
    });

    for (const product of products) {
      const mockupType = product.mockupType ?? "";

      // 1) Category — only if not already set.
      const category = CATEGORY_BY_MOCKUP[mockupType];
      if (category && !product.category) {
        await prisma.product.update({
          where: { id: product.id },
          data: { category },
        });
        productsUpdated++;
        console.log(`  Product "${product.name}" → category "${category}"`);
      }

      // 2) Per-colour variant images — only for products whose mockup config
      //    carries colorImages, and only for variants without an image yet.
      const colorImages = MOCKUP_CONFIG[mockupType]?.colorImages;
      if (!colorImages) continue;

      for (const variant of product.variants) {
        if (variant.imageUrl) continue; // don't overwrite
        const img = colorImages[variant.color];
        if (!img) {
          console.warn(
            `  ! No image for "${product.name}" colour "${variant.color}" — skipped`,
          );
          continue;
        }
        await prisma.variant.update({
          where: { id: variant.id },
          data: { imageUrl: img },
        });
        variantsUpdated++;
      }
    }

    console.log(
      `\nDone. Products updated: ${productsUpdated}, variant images set: ${variantsUpdated}.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
