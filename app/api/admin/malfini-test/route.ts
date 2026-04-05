import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/auth/jwt";
import { getMalfiniToken } from "@/lib/malfini/auth";
import { getCategoryConfig } from "@/lib/malfini/categoryConfig";

const BASE = () => process.env.MALFINI_API_URL ?? "https://api.malfini.com";

async function malfiniRawGet(token: string, path: string) {
  const res = await fetch(`${BASE()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, ok: res.ok, body };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const adminToken = req.cookies.get(COOKIE_NAME)?.value;
  if (!adminToken || !(await verifyAdminToken(adminToken))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let malfiniToken: string;
  try {
    malfiniToken = await getMalfiniToken();
  } catch (err) {
    return NextResponse.json(
      { stage: "auth", error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }

  // ── Products ──────────────────────────────────────────────────────────────
  const productsResult = await malfiniRawGet(malfiniToken, "/api/v4/product?language=hu");
  if (!productsResult.ok || !Array.isArray(productsResult.body)) {
    return NextResponse.json({ stage: "products", ...productsResult }, { status: 502 });
  }

  const products = productsResult.body as Array<{
    code: string;
    categoryCode: string;
    genderCode?: string;
    gender?: string;
    variants: Array<{ nomenclatures: Array<{ productSizeCode: string; sizeName: string }> }>;
  }>;

  // Pick a handful of 3-char product codes from configured categories.
  // The prices and availabilities endpoints filter by product code, not nomenclature code.
  const configuredProducts = products.filter(
    (p) => getCategoryConfig(p.categoryCode) !== null,
  );
  const sampleProductCodes = configuredProducts
    .slice(0, 3)
    .map((p) => p.code)
    .filter(Boolean);

  const skuParam = encodeURIComponent(sampleProductCodes.join(","));

  // ── Prices ─────────────────────────────────────────────────────────────────
  const pricesResult = await malfiniRawGet(
    malfiniToken,
    `/api/v4/product/prices?productCodes=${skuParam}`,
  );

  // ── Recommended prices ────────────────────────────────────────────────────
  const recommendedResult = await malfiniRawGet(
    malfiniToken,
    `/api/v4/product/recommended-prices?productCodes=${skuParam}`,
  );

  // ── Availability (without includeFuture) ──────────────────────────────────
  const availNowResult = await malfiniRawGet(
    malfiniToken,
    `/api/v4/product/availabilities?productCodes=${skuParam}`,
  );

  // ── Availability (with includeFuture=true) ────────────────────────────────
  const availFutureResult = await malfiniRawGet(
    malfiniToken,
    `/api/v4/product/availabilities?productCodes=${skuParam}&includeFuture=true`,
  );

  const allCategoryCodes = [...new Set(products.map((p) => p.categoryCode).filter(Boolean))].sort();

  return NextResponse.json({
    sampleProductCodes,
    configuredProductCount: configuredProducts.length,
    totalProductCount: products.length,
    allCategoryCodes,
    prices: {
      status: pricesResult.status,
      ok: pricesResult.ok,
      body: pricesResult.body,
    },
    recommendedPrices: {
      status: recommendedResult.status,
      ok: recommendedResult.ok,
      body: recommendedResult.body,
    },
    availabilityNow: {
      status: availNowResult.status,
      ok: availNowResult.ok,
      body: availNowResult.body,
    },
    availabilityWithFuture: {
      status: availFutureResult.status,
      ok: availFutureResult.ok,
      body: availFutureResult.body,
    },
  });
}
