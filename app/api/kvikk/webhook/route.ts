import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  applyShipmentStatus,
  getOrderByKvikkTrackingNumber,
} from "@/lib/services/order";
import {
  sendShipmentNotificationEmail,
  sendPickupReadyEmail,
} from "@/lib/services/email";
import { COURIER_LABELS } from "@/lib/shipping/display";
import type { KvikkWebhookPayload } from "@/lib/kvikk/types";

// Kvikk pushes shipment status changes here. We verify the HMAC-SHA256 signature over the
// raw body, then advance the matching order's status from the authenticated payload.
// Supported events: dispatched / shipped / delivered / returned.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.KVIKK_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[kvikk-webhook] KVIKK_WEBHOOK_SECRET not configured");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 }
    );
  }

  const signature = req.headers.get("kvikk-webhook-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await req.text();
  const computed = createHmac("sha256", secret).update(rawBody).digest("hex");
  const sigBuf = Buffer.from(signature);
  const compBuf = Buffer.from(computed);
  if (sigBuf.length !== compBuf.length || !timingSafeEqual(sigBuf, compBuf)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: KvikkWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as KvikkWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const trackingNumber = payload.trackingNumber;
  const tracking = payload.tracking;
  if (!trackingNumber || !tracking) {
    return NextResponse.json({ received: true });
  }

  // We need the order to know its delivery type (the SHIPPED milestone differs for a
  // pickup point) and, for pickup points, the display name/address for the email.
  const order = await getOrderByKvikkTrackingNumber(trackingNumber);
  if (!order) {
    // Unknown shipment (e.g. not created by this shop) — acknowledge and ignore.
    return NextResponse.json({ received: true });
  }

  const isPickup = order.deliveryType === "DELIVERY_POINT";
  const readyForPickup =
    Array.isArray(tracking.events) &&
    tracking.events.some((e) => e.event === "ready_for_pickup");

  // The "SHIPPED" milestone differs by delivery type: for a delivery point the meaningful
  // moment is the parcel ARRIVING at the point (ready_for_pickup); for home delivery it is
  // the parcel entering transit (`shipped`). Keying the status change off this milestone
  // means the customer email fires exactly once — the status transition is monotonic +
  // persisted — even if Kvikk re-pushes the event (e.g. an "still waiting" reminder).
  const shippedMilestone = isPickup ? readyForPickup : !!tracking.shipped;

  // Derive the target status from the authenticated payload (priority order).
  const target: "RETURNED" | "COMPLETE" | "SHIPPED" | null = tracking.returned
    ? "RETURNED"
    : tracking.delivered
      ? "COMPLETE"
      : shippedMilestone
        ? "SHIPPED"
        : null;
  if (!target) {
    return NextResponse.json({ received: true });
  }

  try {
    const changed = await applyShipmentStatus(trackingNumber, target);
    // Notify the customer once, when the shipment first reaches SHIPPED.
    if (changed && target === "SHIPPED" && payload.email) {
      const courierLabel = COURIER_LABELS[payload.courier] ?? payload.courier;
      const trackingLink =
        payload.trackingLink || `https://tracking.kvikk.hu/#/${trackingNumber}`;
      try {
        if (isPickup) {
          // Pickup-point order: "your parcel is ready to collect at the point".
          await sendPickupReadyEmail({
            customerName: payload.name ?? "",
            customerEmail: payload.email,
            courierLabel,
            pointName: order.pickupPointName ?? undefined,
            pointAddress: order.pickupPointAddress ?? undefined,
            trackingNumber,
            trackingLink,
          });
        } else {
          // Home delivery: "your parcel is on its way".
          await sendShipmentNotificationEmail({
            customerName: payload.name ?? "",
            customerEmail: payload.email,
            courierLabel,
            trackingNumber,
            trackingLink,
          });
        }
      } catch (emailErr) {
        console.error("[kvikk-webhook] shipment email failed:", emailErr);
      }
    }
  } catch (err) {
    console.error("[kvikk-webhook] applyShipmentStatus failed:", err);
  }
  return NextResponse.json({ received: true });
}
