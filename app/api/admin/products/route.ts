import { NextRequest, NextResponse } from "next/server";
import { createProduct } from "@/lib/services/product";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/auth/jwt";
import type { ProductInput } from "@/lib/services/product";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as ProductInput;

  if (!body.name?.trim() || !body.slug?.trim()) {
    return NextResponse.json({ error: "Name and slug are required" }, { status: 400 });
  }

  try {
    const product = await createProduct({
      name: body.name.trim(),
      slug: body.slug.trim(),
      description: body.description?.trim() ?? "",
      imageUrl: body.imageUrl?.trim() ?? "",
      mockupType: body.mockupType || null,
      active: body.active ?? true,
    });
    return NextResponse.json(product, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // Unique constraint on slug
    if (message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Ez a slug már foglalt" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
