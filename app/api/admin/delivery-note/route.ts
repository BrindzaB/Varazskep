import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/auth/jwt";
import { createDeliveryNoteForShipments } from "@/lib/services/shipping";
import { KvikkApiError } from "@/lib/kvikk/client";
import type { KvikkCourier } from "@/lib/kvikk/types";

const VALID_COURIERS = new Set<KvikkCourier>([
  "mpl",
  "foxpost",
  "packeta",
  "famafutar",
  "dpd",
  "gls",
]);

// Creates a delivery note (courier pickup manifest) for a batch of shipments.
// Gated by KVIKK_LIVE — this actually requests the courier.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.KVIKK_LIVE !== "true") {
    return NextResponse.json(
      { error: "A futárrendelés jelenleg ki van kapcsolva (KVIKK_LIVE)." },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { pickupDate, pickupFor, shipments } = body as {
    pickupDate?: string;
    pickupFor?: unknown;
    shipments?: unknown;
  };

  if (!pickupDate || !Array.isArray(shipments) || shipments.length === 0) {
    return NextResponse.json(
      { error: "Hiányzó felvételi dátum vagy szállítmány." },
      { status: 400 }
    );
  }

  // pickupFor may be empty (drop-off only). Keep only valid courier slugs.
  const couriers = Array.isArray(pickupFor)
    ? pickupFor.filter((c): c is KvikkCourier =>
        VALID_COURIERS.has(c as KvikkCourier)
      )
    : [];
  const trackingNumbers = shipments.filter(
    (s): s is string => typeof s === "string"
  );

  try {
    const data = await createDeliveryNoteForShipments({
      pickupDate,
      pickupFor: couriers,
      shipments: trackingNumbers,
    });
    return NextResponse.json(data);
  } catch (err) {
    console.error("[admin/delivery-note] failed:", err);
    const message =
      err instanceof KvikkApiError
        ? `Kvikk hiba: ${err.message}`
        : err instanceof Error
          ? err.message
          : "Ismeretlen hiba a futárrendeléskor.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
