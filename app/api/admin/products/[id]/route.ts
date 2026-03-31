import { NextRequest, NextResponse } from "next/server";
import { updateProduct, toggleProductActive } from "@/lib/services/product";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/auth/jwt";
import type { ProductInput } from "@/lib/services/product";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as Partial<ProductInput> & { toggleActive?: boolean };

  try {
    // Simple toggle — only flips the active flag
    if (body.toggleActive !== undefined) {
      const updated = await toggleProductActive(params.id, body.toggleActive);
      return NextResponse.json(updated);
    }

    // Full update
    if (!body.name?.trim() || !body.slug?.trim()) {
      return NextResponse.json({ error: "Name and slug are required" }, { status: 400 });
    }

    const updated = await updateProduct(params.id, {
      name: body.name.trim(),
      slug: body.slug.trim(),
      description: body.description?.trim() ?? "",
      imageUrl: body.imageUrl?.trim() ?? "",
      mockupType: body.mockupType || null,
      active: body.active ?? true,
    });
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Ez a slug már foglalt" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
