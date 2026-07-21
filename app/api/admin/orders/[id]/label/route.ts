import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/auth/jwt";
import { getOrderById } from "@/lib/services/order";
import { getLabel } from "@/lib/kvikk/client";

// Streams the Kvikk shipping label PDF for an order that already has a shipment.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const order = await getOrderById(params.id);
  if (!order || !order.kvikkTrackingNumber) {
    return NextResponse.json(
      { error: "Nincs címke ehhez a rendeléshez." },
      { status: 404 }
    );
  }

  try {
    const { data, contentType, filename } = await getLabel(
      order.kvikkTrackingNumber
    );
    return new NextResponse(data, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[admin/label] failed:", err);
    return NextResponse.json(
      { error: "Nem sikerült letölteni a címkét." },
      { status: 502 }
    );
  }
}
