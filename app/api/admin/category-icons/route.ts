import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/auth/jwt";
import { getProductCategories } from "@/lib/services/product";
import { setCategoryIcons } from "@/lib/services/categoryIcons";
import {
  isCategoryIconKey,
  type CategoryIconKey,
} from "@/lib/shop/categoryIcons";

async function requireAdmin(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  return Boolean(token && (await verifyAdminToken(token)));
}

// Replaces the pictograms of the local product categories (Termékek page tiles).
export async function PUT(req: NextRequest): Promise<NextResponse> {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { icons?: unknown } | null;
  const icons = body?.icons;
  if (typeof icons !== "object" || icons === null || Array.isArray(icons)) {
    return NextResponse.json({ error: "Hibás kérés." }, { status: 400 });
  }

  const categories = new Set(await getProductCategories());
  const out: Record<string, CategoryIconKey> = {};
  for (const [category, icon] of Object.entries(icons)) {
    if (!categories.has(category)) {
      return NextResponse.json(
        { error: `Ismeretlen kategória: ${category}` },
        { status: 400 }
      );
    }
    if (!isCategoryIconKey(icon)) {
      return NextResponse.json(
        { error: `Ismeretlen ikon: ${String(icon)}` },
        { status: 400 }
      );
    }
    out[category] = icon;
  }

  try {
    await setCategoryIcons(out);
    revalidatePath("/products"); // ISR-cached — show the change immediately
    return NextResponse.json({ saved: Object.keys(out).length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
