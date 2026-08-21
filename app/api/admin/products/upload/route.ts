import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin, BUCKET_PRODUCTS } from "@/lib/supabase";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/auth/jwt";

// Allowed raster/vector image types for product & variant photos.
const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Érvénytelen űrlapadat." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A fájl megadása kötelező." }, { status: 400 });
  }

  const ext = EXT_BY_TYPE[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Csak PNG, JPG, WEBP vagy SVG kép tölthető fel." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "A kép legfeljebb 5 MB lehet." },
      { status: 400 },
    );
  }

  try {
    const supabase = createSupabaseAdmin();

    // Ensure the products bucket exists (public read). Idempotent.
    const { data: bucket } = await supabase.storage.getBucket(BUCKET_PRODUCTS);
    if (!bucket) {
      const { error: createErr } = await supabase.storage.createBucket(
        BUCKET_PRODUCTS,
        { public: true },
      );
      // Ignore a race where another request created it first.
      if (createErr && !/already exists/i.test(createErr.message)) {
        return NextResponse.json({ error: createErr.message }, { status: 500 });
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = `${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_PRODUCTS)
      .upload(filename, buffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET_PRODUCTS)
      .getPublicUrl(filename);

    return NextResponse.json({ url: urlData.publicUrl }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ismeretlen hiba.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
