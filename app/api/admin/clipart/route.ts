import { NextRequest, NextResponse } from "next/server";
import { createClipartRecord, uploadClipartSvg } from "@/lib/services/clipart";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/auth/jwt";

function isSvg(file: File): boolean {
  return file.name.toLowerCase().endsWith(".svg") || file.type === "image/svg+xml";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  const darkFile = formData.get("darkFile");
  const name = formData.get("name");
  const category = formData.get("category");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (typeof category !== "string" || !category.trim()) {
    return NextResponse.json({ error: "Category is required" }, { status: 400 });
  }
  if (!isSvg(file)) {
    return NextResponse.json({ error: "Only SVG files are allowed" }, { status: 400 });
  }
  // Dark variant is optional; validate only if provided.
  const hasDark = darkFile instanceof File && darkFile.size > 0;
  if (hasDark && !isSvg(darkFile as File)) {
    return NextResponse.json(
      { error: "A sötét verzió csak SVG lehet." },
      { status: 400 },
    );
  }

  try {
    const svgUrl = await uploadClipartSvg(file);
    const darkSvgUrl = hasDark ? await uploadClipartSvg(darkFile as File) : null;

    const clipart = await createClipartRecord({
      name: name.trim(),
      category: category.trim(),
      svgUrl,
      darkSvgUrl,
    });

    return NextResponse.json(clipart, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
