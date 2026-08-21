import { NextRequest, NextResponse } from "next/server";
import {
  updateVariant,
  deleteVariant,
  getVariantById,
  validateVariantInput,
  VARIANT_CONFLICT,
} from "@/lib/services/product";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/auth/jwt";

// Ensures the variant exists and actually belongs to the product in the URL.
async function belongsToProduct(
  variantId: string,
  productId: string,
): Promise<boolean> {
  const variant = await getVariantById(variantId);
  return variant !== null && variant.productId === productId;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; variantId: string } },
): Promise<NextResponse> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await belongsToProduct(params.variantId, params.id))) {
    return NextResponse.json({ error: "A variáns nem található." }, { status: 404 });
  }

  const parsed = validateVariantInput(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const updated = await updateVariant(params.variantId, params.id, parsed.value);
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === VARIANT_CONFLICT) {
      return NextResponse.json(
        { error: "Már létezik ilyen szín/méret variáns." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; variantId: string } },
): Promise<NextResponse> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await belongsToProduct(params.variantId, params.id))) {
    return NextResponse.json({ error: "A variáns nem található." }, { status: 404 });
  }

  try {
    await deleteVariant(params.variantId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
