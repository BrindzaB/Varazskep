import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/auth/jwt";
import { getProducts } from "@/lib/malfini/client";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const products = await getProducts("hu");

  // Summary stats to make the response easier to inspect
  const categoryCodes = Array.from(new Set(products.map((p) => p.categoryCode))).sort();
  const genderCodes = Array.from(new Set(products.map((p) => p.genderCode).filter(Boolean))).sort();
  const genderValues = Array.from(new Set(products.map((p) => p.gender).filter(Boolean))).sort();

  // Sample: first product in full detail so we can verify shape
  const sampleProduct = products[0] ?? null;
  const sampleImageUrl = sampleProduct?.variants[0]?.images[0]?.link ?? null;

  return NextResponse.json({
    totalProducts: products.length,
    categoryCodes,
    genderCodes,
    genderValues,
    sampleImageUrl,
    products,
  });
}
