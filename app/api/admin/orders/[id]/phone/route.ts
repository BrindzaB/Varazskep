import { NextRequest, NextResponse } from "next/server";
import { updateOrderCustomerPhone } from "@/lib/services/order";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/auth/jwt";
import { normalizeHungarianPhone } from "@/lib/utils/phone";

// Admin correction of the recipient phone on an order — lets a malformed number be fixed
// before the Kvikk shipment is created (Kvikk rejects a bad phone only at label time).
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  // Verify admin token — API routes are not covered by the middleware matcher.
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { phone } = body as { phone?: string };
  const normalized = normalizeHungarianPhone(phone ?? "");
  if (!normalized) {
    return NextResponse.json(
      { error: "Érvénytelen telefonszám. Adjon meg magyar számot." },
      { status: 400 }
    );
  }

  try {
    const updated = await updateOrderCustomerPhone(params.id, normalized);
    return NextResponse.json({ phone: updated.customerPhone });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
