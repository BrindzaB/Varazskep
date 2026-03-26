import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// Seed script uses the direct connection (DIRECT_URL), same as migrations.
// The runtime app uses DATABASE_URL (pooler) via lib/db.ts.
const connectionString = process.env.DIRECT_URL;
if (!connectionString) {
  throw new Error("DIRECT_URL environment variable is not set.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // ── Clean existing data (safe for development resets) ──────────────────────
  await prisma.order.deleteMany();
  await prisma.design.deleteMany();
  await prisma.variant.deleteMany();
  await prisma.product.deleteMany();

  // ── T-shirt ────────────────────────────────────────────────────────────────
  const tshirt = await prisma.product.create({
    data: {
      name: "Egyedi póló",
      slug: "egyedi-polo",
      description:
        "Prémium minőségű, 100% pamut póló egyedi nyomtatással. Tervezze meg saját mintáját a tervezőfelületen!",
      imageUrl: null, // placeholder until real product photos are added
      active: true,
      variants: {
        create: [
          // White
          { color: "Fehér", size: "S", price: 4990, stock: 50 },
          { color: "Fehér", size: "M", price: 4990, stock: 50 },
          { color: "Fehér", size: "L", price: 4990, stock: 50 },
          { color: "Fehér", size: "XL", price: 4990, stock: 50 },
          { color: "Fehér", size: "XXL", price: 5490, stock: 30 },
          // Black
          { color: "Fekete", size: "S", price: 4990, stock: 50 },
          { color: "Fekete", size: "M", price: 4990, stock: 50 },
          { color: "Fekete", size: "L", price: 4990, stock: 50 },
          { color: "Fekete", size: "XL", price: 4990, stock: 50 },
          { color: "Fekete", size: "XXL", price: 5490, stock: 30 },
          // Navy
          { color: "Sötétkék", size: "S", price: 4990, stock: 30 },
          { color: "Sötétkék", size: "M", price: 4990, stock: 30 },
          { color: "Sötétkék", size: "L", price: 4990, stock: 30 },
          { color: "Sötétkék", size: "XL", price: 4990, stock: 30 },
          { color: "Sötétkék", size: "XXL", price: 5490, stock: 20 },
          // Red
          { color: "Piros", size: "S", price: 4990, stock: 20 },
          { color: "Piros", size: "M", price: 4990, stock: 20 },
          { color: "Piros", size: "L", price: 4990, stock: 20 },
          { color: "Piros", size: "XL", price: 4990, stock: 20 },
          { color: "Piros", size: "XXL", price: 5490, stock: 10 },
        ],
      },
    },
  });

  // ── Mug ───────────────────────────────────────────────────────────────────
  const mug = await prisma.product.create({
    data: {
      name: "Egyedi bögre",
      slug: "egyedi-bogre",
      description:
        "Kerámia bögre egyedi nyomtatással, 330 ml. Mosogatógépben mosható, tartós felirattal.",
      imageUrl: null,
      active: true,
      variants: {
        create: [
          { color: "Fehér", size: "330ml", price: 3490, stock: 100 },
          { color: "Fekete", size: "330ml", price: 3990, stock: 50 },
        ],
      },
    },
  });

  console.log(`✓ Created product: ${tshirt.name} (${tshirt.slug})`);
  console.log(`✓ Created product: ${mug.name} (${mug.slug})`);
  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
