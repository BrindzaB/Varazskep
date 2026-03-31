import { NextRequest, NextResponse } from "next/server";
import { createClipartRecord } from "@/lib/services/clipart";
import { createSupabaseAdmin, BUCKET_CLIPART } from "@/lib/supabase";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/auth/jwt";

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
  if (!file.name.toLowerCase().endsWith(".svg") && file.type !== "image/svg+xml") {
    return NextResponse.json({ error: "Only SVG files are allowed" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = `${crypto.randomUUID()}.svg`;

    const supabase = createSupabaseAdmin();
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_CLIPART)
      .upload(filename, buffer, { contentType: "image/svg+xml", upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET_CLIPART)
      .getPublicUrl(filename);

    const clipart = await createClipartRecord({
      name: name.trim(),
      category: category.trim(),
      svgUrl: urlData.publicUrl,
    });

    return NextResponse.json(clipart, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
