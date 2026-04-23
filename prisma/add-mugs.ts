/**
 * Non-destructive one-time script to add the two real mug products.
 * Safe to run against the live database — does NOT call deleteMany.
 * Existing cliparts, products, orders, and designs are untouched.
 *
 * Usage: npx tsx prisma/add-mugs.ts
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const connectionString = process.env.DIRECT_URL;
if (!connectionString) throw new Error("DIRECT_URL environment variable is not set.");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Adding mug products...");

  // Soft-delete the old dummy mug to preserve any Order references on its variants.
  const oldMug = await prisma.product.findUnique({ where: { slug: "egyedi-bogre" } });
  if (oldMug) {
    await prisma.product.update({ where: { slug: "egyedi-bogre" }, data: { active: false } });
    console.log("✓ Deactivated old product: egyedi-bogre");
  }

  const basicMugColors: string[] = [
    "Fehér", "Fekete", "Sötétkék", "Piros", "Bordó", "Középkék",
    "Lila", "Menta", "Napsárga", "Narancs", "Rózsaszín", "Sárga",
    "Sötétzöld", "Türkiz", "Világos zöld", "Világoskék",
  ];

  const spoonMugColors: string[] = [
    "Barna", "Kék", "Narancs", "Piros", "Rózsaszín", "Sárga", "Zöld", "Fekete",
  ];

  // Upsert Sima Bögre
  const basicMug = await prisma.product.upsert({
    where: { slug: "basic-mug" },
    update: { active: true },
    create: {
      name: "Sima Bögre",
      slug: "basic-mug",
      description:
        "Kerámia bögre egyedi nyomtatással, 330 ml. Mosogatógépben mosható, tartós felirattal.",
      imageUrl: "/mugs/basic_mug/Feh%C3%A9r.jpg",
      active: true,
      mockupType: "basic_mug",
      variants: {
        create: basicMugColors.map((color) => ({
          color,
          size: "330ml",
          price: 2990,
          stock: 50,
        })),
      },
    },
  });
  console.log(`✓ Upserted product: ${basicMug.name} (${basicMug.slug}) — ${basicMugColors.length} variants`);

  // Upsert Kanalas Bögre
  const spoonMug = await prisma.product.upsert({
    where: { slug: "mug-with-spoon" },
    update: { active: true },
    create: {
      name: "Kanalas Bögre",
      slug: "mug-with-spoon",
      description:
        "Kerámia bögre kanállal és egyedi nyomtatással, 330 ml. Mosogatógépben mosható.",
      imageUrl: "/mugs/mug_with_spoon/Kanalas_K%C3%A9k.jpg",
      active: true,
      mockupType: "mug_with_spoon",
      variants: {
        create: spoonMugColors.map((color) => ({
          color,
          size: "330ml",
          price: 3990,
          stock: 50,
        })),
      },
    },
  });
  console.log(`✓ Upserted product: ${spoonMug.name} (${spoonMug.slug}) — ${spoonMugColors.length} variants`);

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
