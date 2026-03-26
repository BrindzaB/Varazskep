import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

// Load .env.local so Prisma CLI commands pick up environment variables.
// Next.js loads .env.local automatically at runtime — this covers CLI usage.
dotenv.config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // DIRECT_URL: Direct connection (port 5432) — required for Prisma CLI and migrations.
    // The app uses DATABASE_URL (Transaction pooler) at runtime via lib/db.ts.
    url: process.env["DIRECT_URL"],
  },
});
