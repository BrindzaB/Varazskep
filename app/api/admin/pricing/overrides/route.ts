import { NextRequest, NextResponse } from "next/server";
import {
  clearPriceOverrides,
  setPriceOverrides,
  validatePriceOverrides,
  validateSkuList,
} from "@/lib/pricing/overrides";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/auth/jwt";

async function requireAdmin(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  return Boolean(token && (await verifyAdminToken(token)));
}

// Bulk upsert — one request covers a single edited row and a whole product alike.
export async function PUT(req: NextRequest): Promise<NextResponse> {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = validatePriceOverrides(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    await setPriceOverrides(parsed.value);
    return NextResponse.json({ saved: parsed.value.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Clearing an override deletes the row, so the SKU falls back to the computed price.
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = validateSkuList(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const cleared = await clearPriceOverrides(parsed.value);
    return NextResponse.json({ cleared });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
