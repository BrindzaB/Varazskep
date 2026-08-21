import { NextRequest, NextResponse } from "next/server";
import {
  createDesign,
  saveDesignPreview,
  type CanvasJson,
} from "@/lib/services/design";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = body as { canvasJson?: unknown; previewDataUrl?: unknown };

  if (
    !parsed.canvasJson ||
    typeof parsed.canvasJson !== "object" ||
    Array.isArray(parsed.canvasJson)
  ) {
    return NextResponse.json({ error: "Missing or invalid canvasJson" }, { status: 400 });
  }

  const canvasJson = parsed.canvasJson as CanvasJson;

  try {
    const design = await createDesign(canvasJson);

    // Best-effort: store the client-captured composite preview. A failure here
    // must not fail the design save (the design-only preview still works).
    if (
      typeof parsed.previewDataUrl === "string" &&
      parsed.previewDataUrl.startsWith("data:image/png;base64,")
    ) {
      try {
        await saveDesignPreview(design.id, parsed.previewDataUrl);
      } catch (err) {
        console.error("[POST /api/designs] preview upload failed:", err);
      }
    }

    return NextResponse.json({ id: design.id });
  } catch (err) {
    console.error("[POST /api/designs] createDesign failed:", err);
    return NextResponse.json({ error: "Failed to save design" }, { status: 500 });
  }
}
