import { NextRequest, NextResponse } from "next/server";
import {
  toggleClipartActive,
  updateClipart,
  uploadClipartSvg,
  type ClipartUpdate,
} from "@/lib/services/clipart";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/auth/jwt";

function isSvg(file: File): boolean {
  return file.name.toLowerCase().endsWith(".svg") || file.type === "image/svg+xml";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") ?? "";

  // ── Multipart → full edit (name/category + optional SVG replace/remove) ──────
  if (contentType.includes("multipart/form-data")) {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }

    const name = formData.get("name");
    const category = formData.get("category");
    const lightFile = formData.get("file");
    const darkFile = formData.get("darkFile");
    const removeDark = formData.get("removeDark") === "true";

    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "A név megadása kötelező." }, { status: 400 });
    }
    if (typeof category !== "string" || !category.trim()) {
      return NextResponse.json({ error: "A kategória megadása kötelező." }, { status: 400 });
    }

    const data: ClipartUpdate = { name: name.trim(), category: category.trim() };

    try {
      if (lightFile instanceof File && lightFile.size > 0) {
        if (!isSvg(lightFile)) {
          return NextResponse.json({ error: "A világos verzió csak SVG lehet." }, { status: 400 });
        }
        data.svgUrl = await uploadClipartSvg(lightFile);
      }

      if (darkFile instanceof File && darkFile.size > 0) {
        if (!isSvg(darkFile)) {
          return NextResponse.json({ error: "A sötét verzió csak SVG lehet." }, { status: 400 });
        }
        data.darkSvgUrl = await uploadClipartSvg(darkFile);
      } else if (removeDark) {
        data.darkSvgUrl = null;
      }

      const updated = await updateClipart(params.id, data);
      return NextResponse.json(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // ── JSON → toggle active (existing behaviour) ────────────────────────────────
  const body = (await req.json().catch(() => ({}))) as { toggleActive?: boolean };

  if (body.toggleActive === undefined) {
    return NextResponse.json({ error: "toggleActive is required" }, { status: 400 });
  }

  try {
    const updated = await toggleClipartActive(params.id, body.toggleActive);
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
