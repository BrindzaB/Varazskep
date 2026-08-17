import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/auth/jwt";
import {
  buildDesignSvg,
  getDesignCanvasByOrderId,
} from "@/lib/services/design";

// Serves the order's custom-design SVG for the admin preview, rebuilt on the fly from the
// stored canvas. We serve it ourselves instead of linking the Supabase public URL because
// Supabase Storage now serves public-bucket SVGs with `Content-Disposition: attachment` and a
// `default-src 'none'; sandbox` CSP (an SVG-XSS hardening) — which forces a download and blocks
// the embedded images. Here we set inline disposition and a CSP that permits embedded raster
// images but no scripts, so the preview renders again without triggering a download.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canvasJson = await getDesignCanvasByOrderId(params.id);
  if (!canvasJson) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const svg = buildDesignSvg(canvasJson);
  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": "inline",
      // Same-origin now, so lock it down: allow embedded raster images, block scripts.
      "Content-Security-Policy": "default-src 'none'; img-src https: data:",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
