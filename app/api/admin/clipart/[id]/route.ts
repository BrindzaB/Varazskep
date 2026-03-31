import { NextRequest, NextResponse } from "next/server";
import { toggleClipartActive } from "@/lib/services/clipart";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/auth/jwt";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { toggleActive?: boolean };

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
