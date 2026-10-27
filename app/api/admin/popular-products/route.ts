import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/auth/jwt";
import { getProducts } from "@/lib/malfini/client";
import { getProductDesignConfig } from "@/lib/malfini/categoryConfig";
import {
  findExistingLocalProductIds,
  setPopularProductKeys,
} from "@/lib/services/popular";
import { MAX_POPULAR_PRODUCTS, parsePopularKey } from "@/lib/shop/popular";

async function requireAdmin(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  return Boolean(token && (await verifyAdminToken(token)));
}

// Replaces the "Népszerű termékek" list on the Termékek page, in the given order.
export async function PUT(req: NextRequest): Promise<NextResponse> {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { keys?: unknown } | null;
  const keys = body?.keys;
  if (!Array.isArray(keys) || !keys.every((k): k is string => typeof k === "string")) {
    return NextResponse.json({ error: "Hibás kérés." }, { status: 400 });
  }
  if (keys.length > MAX_POPULAR_PRODUCTS) {
    return NextResponse.json(
      { error: `Legfeljebb ${MAX_POPULAR_PRODUCTS} népszerű termék lehet.` },
      { status: 400 }
    );
  }
  if (new Set(keys).size !== keys.length) {
    return NextResponse.json(
      { error: "Egy termék csak egyszer szerepelhet." },
      { status: 400 }
    );
  }

  // Every key must name a product the Termékek page can show: a designer-enabled Malfini
  // product (the page lists only those) or an existing local product.
  const parsed = keys.map(parsePopularKey);
  const malfiniCodes = parsed.flatMap((p) => (p?.source === "malfini" ? [p.code] : []));
  const localIds = parsed.flatMap((p) => (p?.source === "local" ? [p.productId] : []));

  const [catalog, knownLocal] = await Promise.all([
    malfiniCodes.length > 0 ? getProducts("hu") : Promise.resolve([]),
    findExistingLocalProductIds(localIds),
  ]);

  const unknown = keys.filter((key, i) => {
    const ref = parsed[i];
    if (!ref) return true;
    if (ref.source === "local") return !knownLocal.has(ref.productId);
    const product = catalog.find((p) => p.code === ref.code);
    return !product || getProductDesignConfig(product) === null;
  });
  if (unknown.length > 0) {
    return NextResponse.json(
      { error: `Nem választható termék: ${unknown.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    await setPopularProductKeys(keys);
    revalidatePath("/products"); // ISR-cached — show the change immediately
    return NextResponse.json({ saved: keys.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
