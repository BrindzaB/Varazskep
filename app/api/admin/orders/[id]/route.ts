import { NextRequest, NextResponse } from "next/server";
import { updateOrderStatus } from "@/lib/services/order";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/auth/jwt";
import type { OrderStatus } from "@/lib/generated/prisma/client";

const VALID_STATUSES = new Set<OrderStatus>([
  "PENDING",
  "PAID",
  "IN_PRODUCTION",
  "SHIPPED",
  "COMPLETE",
  "CANCELLED",
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  // Verify admin token — API routes are not covered by middleware matcher.
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { status } = (await req.json()) as { status: string };

  if (!VALID_STATUSES.has(status as OrderStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    const updated = await updateOrderStatus(params.id, status as OrderStatus);
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
