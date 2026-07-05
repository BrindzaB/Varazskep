import { NextResponse } from "next/server";
import { getActiveClipart } from "@/lib/services/clipart";

// Clipart is DB-backed mutable data — never statically cache this response.
// Next.js 14 caches GET route handlers by default, which on Vercel froze the
// build-time clipart list (and its now-deleted storage URLs) for weeks.
export const dynamic = "force-dynamic";

// GET /api/clipart — returns all active clipart items
export async function GET() {
  const items = await getActiveClipart();
  return NextResponse.json(items);
}
