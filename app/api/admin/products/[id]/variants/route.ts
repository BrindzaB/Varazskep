import { NextRequest, NextResponse } from "next/server";
import {
  createVariant,
  validateVariantInput,
  VARIANT_CONFLICT,
} from "@/lib/services/product";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/auth/jwt";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = validateVariantInput(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const variant = await createVariant(params.id, parsed.value);
    return NextResponse.json(variant, { status: 201 });
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
