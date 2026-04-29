import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/auth/jwt";
import { getProduct, getProducts } from "@/lib/malfini/client";
import { getCategoryConfig } from "@/lib/malfini/categoryConfig";

// GET /api/admin/image-inspect?code=150
// Returns all image URLs for every variant of the given product.
// If no code is provided, uses the first configured product in the catalog.
// Admin-only — requires a valid admin_token cookie.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const adminToken = req.cookies.get(COOKIE_NAME)?.value;
  if (!adminToken || !(await verifyAdminToken(adminToken))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  let code = searchParams.get("code") ?? null;

  // If no code given, pick the first configured product
  if (!code) {
    const all = await getProducts("hu");
    const first = all.find((p) => getCategoryConfig(p.categoryCode) !== null);
    if (!first) {
      return NextResponse.json({ error: "No configured products found" }, { status: 404 });
    }
    code = first.code;
  }

  const product = await getProduct(code, "hu");
  if (!product) {
    return NextResponse.json({ error: `Product "${code}" not found` }, { status: 404 });
  }

  const variants = product.variants.map((v) => ({
    variantCode: v.code,
    colorName: v.name,
    images: v.images.map((img) => ({
      viewCode: img.viewCode,
      link: img.link,
    })),
  }));

  return NextResponse.json({
    productCode: product.code,
    productName: product.name,
    categoryCode: product.categoryCode,
    variantCount: variants.length,
    variants,
  });
}

