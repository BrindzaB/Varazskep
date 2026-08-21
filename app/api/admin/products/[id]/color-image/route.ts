import { NextRequest, NextResponse } from "next/server";
import { setColorImage } from "@/lib/services/product";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/auth/jwt";

// Sets (or clears) the storefront image for all variants of one colour.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    color?: unknown;
    imageUrl?: unknown;
  } | null;

  const color = typeof body?.color === "string" ? body.color.trim() : "";
  if (!color) {
    return NextResponse.json({ error: "A szín megadása kötelező." }, { status: 400 });
  }

  // imageUrl must be a non-empty string (set) or null (clear).
  let imageUrl: string | null;
  if (body?.imageUrl === null) {
    imageUrl = null;
  } else if (typeof body?.imageUrl === "string" && body.imageUrl.trim()) {
    imageUrl = body.imageUrl.trim();
  } else {
    return NextResponse.json(
      { error: "Érvénytelen kép URL." },
      { status: 400 },
    );
  }

  try {
    const result = await setColorImage(params.id, color, imageUrl);
    return NextResponse.json({ updated: result.count });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ismeretlen hiba.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
