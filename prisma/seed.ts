import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config({ path: ".env.local" });

// Seed script uses the direct connection (DIRECT_URL), same as migrations.
// The runtime app uses DATABASE_URL (pooler) via lib/db.ts.
const connectionString = process.env.DIRECT_URL;
if (!connectionString) {
  throw new Error("DIRECT_URL environment variable is not set.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// Supabase admin client — needs service role key to write to Storage
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
  );
}
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

const CLIPART_BUCKET = process.env.SUPABASE_STORAGE_BUCKET_CLIPART ?? "clipart";

// Uploads a local SVG file to the clipart bucket and returns its public URL.
async function uploadClipartSvg(
  fileName: string,
  localPath: string,
): Promise<string> {
  const fileBuffer = fs.readFileSync(localPath);

  const { error } = await supabase.storage
    .from(CLIPART_BUCKET)
    .upload(fileName, fileBuffer, {
      contentType: "image/svg+xml",
      upsert: true, // safe to re-run seed without duplicate errors
    });

  if (error) throw new Error(`Storage upload failed for ${fileName}: ${error.message}`);

  const { data } = supabase.storage.from(CLIPART_BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
}

async function main() {
  console.log("Seeding database...");

  // ── Clean existing data (safe for development resets) ──────────────────────
  await prisma.order.deleteMany();
  await prisma.design.deleteMany();
  await prisma.variant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.clipart.deleteMany();

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

  // ── Clipart ────────────────────────────────────────────────────────────────
  const assetsDir = path.join(__dirname, "seed-assets", "clipart");

  const clipartItems = [
    { file: "star.svg", name: "Csillag", category: "Formák" },
    { file: "heart.svg", name: "Szív", category: "Formák" },
    { file: "lightning.svg", name: "Villám", category: "Formák" },
    { file: "sun.svg", name: "Nap", category: "Természet" },
    { file: "leaf.svg", name: "Levél", category: "Természet" },
    { file: "flower.svg", name: "Virág", category: "Természet" },
  ];

  for (const item of clipartItems) {
    const localPath = path.join(assetsDir, item.file);
    const svgUrl = await uploadClipartSvg(item.file, localPath);
    await prisma.clipart.create({
      data: { name: item.name, category: item.category, svgUrl, active: true },
    });
    console.log(`✓ Uploaded clipart: ${item.name} → ${svgUrl}`);
  }

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
