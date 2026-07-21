import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/auth/jwt";
import { createShipmentForOrder } from "@/lib/services/shipping";
import { KvikkApiError } from "@/lib/kvikk/client";

// Creates the Kvikk shipment + label for an order (admin action, when the product is ready).
// Gated by KVIKK_LIVE so a dev/staging environment can't accidentally create real shipments.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.KVIKK_LIVE !== "true") {
    return NextResponse.json(
      { error: "A csomagfeladás jelenleg ki van kapcsolva (KVIKK_LIVE)." },
      { status: 400 }
    );
  }

  try {
    const result = await createShipmentForOrder(params.id);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[admin/shipment] failed:", err);
    const message =
      err instanceof KvikkApiError
        ? `Kvikk hiba: ${err.message}`
        : err instanceof Error
          ? err.message
          : "Ismeretlen hiba a csomagfeladáskor.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
