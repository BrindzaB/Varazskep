import { NextRequest, NextResponse } from "next/server";

// Same-origin proxy for Malfini's product images. The designer loads mockups
// through this so the Fabric canvas stays CORS-clean and can be exported to a
// PNG (the order-detail composite). Locked to Malfini's image CDN + image paths
// to avoid being an open proxy (SSRF).
const ALLOWED_HOST = "api.malfini.com";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const target = req.nextUrl.searchParams.get("url");
  if (!target) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== ALLOWED_HOST ||
    !parsed.pathname.startsWith("/image/")
  ) {
    return NextResponse.json({ error: "Forbidden host" }, { status: 403 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(parsed.toString());
  } catch {
    return NextResponse.json({ error: "Upstream fetch failed" }, { status: 502 });
  }
  if (!upstream.ok) {
    return NextResponse.json({ error: "Upstream error" }, { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ error: "Not an image" }, { status: 415 });
  }

  const body = await upstream.arrayBuffer();
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
