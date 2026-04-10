import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/auth/jwt";
import { getProducts } from "@/lib/malfini/client";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const adminToken = req.cookies.get(COOKIE_NAME)?.value;
  if (!adminToken || !(await verifyAdminToken(adminToken))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const products = await getProducts("hu");
  const poloShirts = products.filter((p) => p.categoryCode === "polo-shirts");

  const report = poloShirts.map((p) => ({
    code: p.code,
    name: p.name,
    variants: p.variants.map((v) => ({
      code: v.code,
      colorName: v.name,
      viewCodes: v.images.map((i) => i.viewCode),
      hasBack: v.images.some((i) => i.viewCode === "b"),
    })),
    anyVariantHasBack: p.variants.some((v) => v.images.some((i) => i.viewCode === "b")),
  }));

  const summary = {
    totalPoloProducts: poloShirts.length,
    productsWithBackImage: report.filter((p) => p.anyVariantHasBack).length,
    productsWithoutBackImage: report.filter((p) => !p.anyVariantHasBack).length,
  };

  return NextResponse.json({ summary, products: report });
}
