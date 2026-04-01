import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/auth/jwt";
import { getMalfiniToken } from "@/lib/malfini/auth";

const BASE = () => process.env.MALFINI_API_URL ?? "https://api.malfini.com";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const adminToken = req.cookies.get(COOKIE_NAME)?.value;
  if (!adminToken || !(await verifyAdminToken(adminToken))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Step 1: test auth
  let malfiniToken: string;
  try {
    malfiniToken = await getMalfiniToken();
  } catch (err) {
    return NextResponse.json(
      { stage: "auth", error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }

  // Step 2: fetch products — no try/catch so the raw error surfaces
  const url = `${BASE()}/api/v4/product?language=hu`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${malfiniToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return NextResponse.json(
      { stage: "products", status: res.status, statusText: res.statusText, body },
      { status: 502 }
    );
  }

  const products = await res.json();

  if (!Array.isArray(products)) {
    return NextResponse.json({ stage: "products", error: "Response is not an array", raw: products }, { status: 502 });
  }

  const categoryCodes = Array.from(new Set(products.map((p: { categoryCode: string }) => p.categoryCode))).sort();
  const genderCodes = Array.from(new Set(products.map((p: { genderCode?: string }) => p.genderCode).filter(Boolean))).sort();
  const genderValues = Array.from(new Set(products.map((p: { gender?: string }) => p.gender).filter(Boolean))).sort();
  const sampleImageUrl = products[0]?.variants?.[0]?.images?.[0]?.link ?? null;

  return NextResponse.json({
    totalProducts: products.length,
    categoryCodes,
    genderCodes,
    genderValues,
    sampleImageUrl,
    products,
  });
}
