import { NextRequest, NextResponse } from "next/server";
import { createDesign, type CanvasJson } from "@/lib/services/design";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = body as { canvasJson?: unknown };

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
    return NextResponse.json({ id: design.id });
  } catch (err) {
    console.error("[POST /api/designs] createDesign failed:", err);
    return NextResponse.json({ error: "Failed to save design" }, { status: 500 });
  }
}
