import { NextRequest, NextResponse } from "next/server";
import {
  getShopSettings,
  updateShopSettings,
  validateShopSettings,
} from "@/lib/services/shopSettings";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/auth/jwt";

async function requireAdmin(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  return Boolean(token && (await verifyAdminToken(token)));
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await getShopSettings());
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = validateShopSettings(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    await updateShopSettings(parsed.value);
    return NextResponse.json(parsed.value);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
