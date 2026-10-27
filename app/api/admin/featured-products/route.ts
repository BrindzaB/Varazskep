import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/auth/jwt";
import { getProducts } from "@/lib/malfini/client";
import { getProductDesignConfig } from "@/lib/malfini/categoryConfig";
import { setFeaturedMalfiniCodes } from "@/lib/services/featured";

async function requireAdmin(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  return Boolean(token && (await verifyAdminToken(token)));
}

// Replaces the featured Malfini list (designer picker + order form), in the given order.
export async function PUT(req: NextRequest): Promise<NextResponse> {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { codes?: unknown } | null;
  const codes = body?.codes;
  if (
    !Array.isArray(codes) ||
    codes.length === 0 ||
    !codes.every((c): c is string => typeof c === "string")
  ) {
    return NextResponse.json(
      { error: "Legalább egy terméket ki kell választani." },
      { status: 400 }
    );
  }
  if (new Set(codes).size !== codes.length) {
    return NextResponse.json(
      { error: "Egy termék csak egyszer szerepelhet." },
      { status: 400 }
    );
  }

  // Only designer-enabled products: the picker opens the designer with them.
  const catalog = await getProducts("hu");
  const unknown = codes.filter((code) => {
    const product = catalog.find((p) => p.code === code);
    return !product || getProductDesignConfig(product) === null;
  });
  if (unknown.length > 0) {
    return NextResponse.json(
      { error: `Nem választható termékkód: ${unknown.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    await setFeaturedMalfiniCodes(codes);
    return NextResponse.json({ saved: codes.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
