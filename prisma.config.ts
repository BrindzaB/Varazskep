import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

// Load .env.local so Prisma CLI commands pick up the DATABASE_URL.
// Next.js loads .env.local automatically at runtime — this covers CLI usage.
dotenv.config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
