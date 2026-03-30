import { NextResponse } from "next/server";
import { getActiveClipart } from "@/lib/services/clipart";

// GET /api/clipart — returns all active clipart items
export async function GET() {
  const items = await getActiveClipart();
  return NextResponse.json(items);
}
